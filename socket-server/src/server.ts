/** Socket admission, room isolation, and coarse presence for live sessions. */
import type { Server as HttpServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Server, type Socket } from "socket.io";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  foundationPingSchema,
  roomJoinSchema,
} from "../../shared/protocol/socket.js";
import { attachClassroomHandlers } from "./protocol.js";
import { clearHotScene, hotStateStats, isRoomRevoked, markRoomRevoked, sweepHotState } from "./board-hot-state.js";
import { LIMITS, type LimitOverrides } from "./config.js";
import { allowAction, createRateLimitState } from "./rate-limit.js";
import { roomName } from "./rooms.js";

export type RoomClaims = {
  sessionId: string;
  role: "teacher" | "student";
  subjectId: string;
  exp: number;
};

function encodePart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodePart<T>(encoded: string): T | null {
  try {
    const value = Buffer.from(encoded, "base64url").toString("utf8");
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Mint a short-lived SVRT1 room token using the same HMAC format as verifyRoomToken. */
export function mintRoomToken(
  sessionId: string,
  role: "teacher" | "student",
  subjectId: string,
  secret: string,
  ttlSeconds = 300,
): string {
  const header = encodePart({ alg: "HS256", typ: "SVRT1" });
  const payload = encodePart({
    v: 1,
    sessionId,
    role,
    subjectId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Verify the Convex-issued SVRT1 token without consulting browser role fields. */
export function verifyRoomToken(token: string, secret = process.env.SOCKET_INTERNAL_SECRET): RoomClaims | null {
  const configuredSecret = secret?.trim();
  if (!configuredSecret || configuredSecret.length < 32 || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = decodePart<{ alg?: string; typ?: string }>(parts[0]);
  const claims = decodePart<Partial<RoomClaims> & { v?: number }>(parts[1]);
  if (header?.alg !== "HS256" || header.typ !== "SVRT1" || claims?.v !== 1) return null;
  if (
    typeof claims.sessionId !== "string" || !claims.sessionId ||
    (claims.role !== "teacher" && claims.role !== "student") ||
    typeof claims.subjectId !== "string" || !claims.subjectId ||
    typeof claims.exp !== "number" || !Number.isInteger(claims.exp) ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) return null;

  const expected = createHmac("sha256", configuredSecret).update(`${parts[0]}.${parts[1]}`).digest();
  const supplied = Buffer.from(parts[2], "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return claims as RoomClaims;
}

function emitPresenceNow(io: Server, sessionId: string): void {
  const room = roomName(sessionId);
  const connectedCount = io.sockets.adapter.rooms.get(room)?.size ?? 0;
  io.to(room).emit(SOCKET_EVENTS.roomPresence, {
    v: SOCKET_PROTOCOL_VERSION,
    sessionId,
    ts: Date.now(),
    connectedCount,
  });
}

/**
 * Resolve the peer address used for per-address connection accounting.
 *
 * `handshake.address` is the socket peer, which behind a load balancer is the
 * balancer itself — every client would collapse onto one key and a per-address
 * cap would throttle the whole service instead of one abuser. So a deployment
 * behind a proxy must say so, and then the *rightmost* X-Forwarded-For entry is
 * used: that hop is appended by our own trusted proxy, so a client that forges
 * the header only pollutes entries to its left. Trusting the leftmost value —
 * the common mistake — would make the cap trivially bypassable.
 *
 * The one-trusted-hop assumption is stated in docs/20_DEPLOYMENT_ENVIRONMENT.md.
 */
function resolveAddress(socket: Socket, trustProxy: boolean): string {
  if (trustProxy) {
    const header = socket.handshake.headers["x-forwarded-for"];
    const raw = Array.isArray(header) ? header.join(",") : header;
    const hops = (raw ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return socket.handshake.address || "unknown";
}

/** Increment a counter map, returning the new value. */
function increment(counts: Map<string, number>, key: string): number {
  const next = (counts.get(key) ?? 0) + 1;
  counts.set(key, next);
  return next;
}

/** Decrement a counter map, deleting the key at zero so the map cannot grow forever. */
function decrement(counts: Map<string, number>, key: string): void {
  const next = (counts.get(key) ?? 0) - 1;
  if (next > 0) counts.set(key, next);
  else counts.delete(key);
}

function emitProtocolError(socket: Socket, sessionId: string, code: string, message: string): void {
  socket.emit(SOCKET_EVENTS.protocolError, {
    v: SOCKET_PROTOCOL_VERSION,
    sessionId,
    ts: Date.now(),
    code,
    message,
  });
}

function constantTimeSignatureMatches(body: string, timestamp: string | null, supplied: string | null, secret: string): boolean {
  if (!timestamp || !supplied || !/^\d+$/.test(timestamp)) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 60_000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  const actual = Buffer.from(supplied, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSocketServer(
  httpServer: HttpServer,
  allowedOrigins: string[],
  overrides: LimitOverrides = {},
) {
  // Overrides exist so a test can drive a cap with three sockets instead of 256.
  // Production passes nothing and gets LIMITS verbatim.
  const limits = { ...LIMITS, ...overrides };
  const trustProxy = process.env.RELAY_TRUST_PROXY === "1";

  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
    // Frames larger than this are dropped by the transport before Zod ever runs,
    // and the connection is closed. Derived from the protocol ceiling so a board
    // carrying the maximum allowed images still fails validation cleanly rather
    // than killing the teacher's socket mid-lesson.
    maxHttpBufferSize: limits.maxHttpBufferSize,
    // Socket.IO's default, restated because board scenes are large JSON and
    // enabling compression here looks like an obvious win. It is not: the
    // upstream guidance is that permessage-deflate costs significant CPU and
    // memory per connection, and this process holds hundreds of them while a
    // class is running. Bandwidth is not the relay's constraint; head-of-line
    // latency during a stroke burst is.
    perMessageDeflate: false,
  });
  // One writer lease per room. The subject is kept alongside the socket so the
  // same teacher reconnecting (tab reload, network flap) can take the lease over
  // from their own stale socket instead of being locked out by it.
  const activeTeacherWriters = new Map<string, { socketId: string; subjectId: string }>();

  // Connection accounting. Tokenless sockets are tracked separately because they
  // are the only path here that never presents a Convex-minted token.
  const socketsPerAddress = new Map<string, number>();
  const tokenlessPerAddress = new Map<string, number>();
  let tokenlessTotal = 0;

  // Presence debounce state, one entry per live room.
  const lastPresenceAt = new Map<string, number>();
  const pendingPresence = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Emit presence at most once per `presenceMinIntervalMs` per room.
   *
   * Leading edge so the first join is instant, trailing edge so the final count
   * is still correct after a burst. Without this, `room:join` is an amplifier:
   * one admitted student can turn a small frame into a fan-out across every
   * socket in the room, up to `maxSocketsPerRoom` times over.
   */
  const schedulePresence = (sessionId: string): void => {
    const now = Date.now();
    const elapsed = now - (lastPresenceAt.get(sessionId) ?? 0);
    if (elapsed >= limits.presenceMinIntervalMs) {
      lastPresenceAt.set(sessionId, now);
      emitPresenceNow(io, sessionId);
      return;
    }
    if (pendingPresence.has(sessionId)) return;
    const timer = setTimeout(() => {
      pendingPresence.delete(sessionId);
      lastPresenceAt.set(sessionId, Date.now());
      emitPresenceNow(io, sessionId);
    }, limits.presenceMinIntervalMs - elapsed);
    timer.unref?.();
    pendingPresence.set(sessionId, timer);
  };

  const sweepTimer = setInterval(() => {
    sweepHotState();
    // Presence bookkeeping outlives the room it describes, so drop entries whose
    // room no longer has sockets. Small per entry, unbounded over a long uptime.
    for (const sessionId of [...lastPresenceAt.keys()]) {
      if (!io.sockets.adapter.rooms.get(roomName(sessionId)) && !pendingPresence.has(sessionId)) {
        lastPresenceAt.delete(sessionId);
      }
    }
  }, LIMITS.sweepIntervalMs);
  // Never hold the process open for a housekeeping timer.
  sweepTimer.unref?.();
  httpServer.on("close", () => clearInterval(sweepTimer));

  const revokeRoom = (sessionId: string) => {
    markRoomRevoked(sessionId);
    const room = roomName(sessionId);
    // Walk the room's own membership rather than every socket on the process.
    // The previous form iterated all sockets server-wide on each revocation and
    // still missed nothing, but End Class on a busy relay is exactly when the
    // process is least able to afford an O(all sockets) scan per room.
    for (const socketId of [...(io.sockets.adapter.rooms.get(room) ?? [])]) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      emitProtocolError(socket, sessionId, "ROOM_REVOKED", "This classroom has ended.");
      socket.disconnect(true);
    }
    activeTeacherWriters.delete(sessionId);
    const pending = pendingPresence.get(sessionId);
    if (pending) clearTimeout(pending);
    pendingPresence.delete(sessionId);
    lastPresenceAt.delete(sessionId);
    clearHotScene(sessionId);
  };

  // Plain-HTTP surface. Socket.IO handles its own `/socket.io/*` path and defers
  // everything else to these listeners; without a terminal response here an
  // unmatched request would hang until the client gave up, which is what a
  // platform health check looks like when it fails.
  httpServer.on("request", (request, response) => {
    const path = (request.url ?? "/").split("?")[0];

    if (request.method === "GET" && (path === "/healthz" || path === "/")) {
      const stats = hotStateStats();
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({
        ok: true,
        service: "syncvas-socket",
        protocolVersion: SOCKET_PROTOCOL_VERSION,
        uptimeSeconds: Math.floor(process.uptime()),
        connectedSockets: io.sockets.sockets.size,
        ...stats,
      }));
      return;
    }

    if (request.method !== "POST" || path !== "/internal/revoke-room") {
      // Socket.IO's own handler already answered its path; anything still
      // unmatched here is genuinely not ours.
      if (path.startsWith("/socket.io")) return;
      response.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ error: "NOT_FOUND" }));
      return;
    }
    const secret = process.env.SOCKET_INTERNAL_SECRET?.trim();
    if (!secret || secret.length < 32) {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "NOT_CONFIGURED" }));
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= 4_096) chunks.push(chunk);
    });
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (bytes > 4_096 || !constantTimeSignatureMatches(body, request.headers["x-syncvas-timestamp"] as string | null, request.headers["x-syncvas-signature"] as string | null, secret)) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "UNAUTHORIZED" }));
        return;
      }
      try {
        const parsed = JSON.parse(body) as { sessionId?: unknown };
        if (typeof parsed.sessionId !== "string" || parsed.sessionId.length < 1 || parsed.sessionId.length > 128) throw new Error("invalid");
        revokeRoom(parsed.sessionId);
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(JSON.stringify({ ok: true }));
      } catch {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "INVALID_REQUEST" }));
      }
    });
  });

  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    // Health-only connections remain available; room admission still requires a token.
    if (auth?.token === undefined) return next();
    const claims = typeof auth.token === "string" ? verifyRoomToken(auth.token) : null;
    if (!claims) return next(new Error("UNAUTHORIZED"));
    socket.data.roomClaims = claims;
    next();
  });

  io.on("connection", (socket) => {
    const claims = socket.data.roomClaims as RoomClaims | undefined;
    const admittedRoom = claims ? roomName(claims.sessionId) : null;
    const address = resolveAddress(socket, trustProxy);

    // One rate budget per socket, shared with the classroom handlers, so a client
    // cannot get a fresh allowance simply by switching which event it floods.
    const rateState = createRateLimitState();
    socket.data.rateState = rateState;

    // Account before any rejection path, and release on disconnect. Registering
    // the decrement first means every early return below still balances.
    const addressCount = increment(socketsPerAddress, address);
    let tokenlessAddressCount = 0;
    if (!claims) {
      tokenlessTotal += 1;
      tokenlessAddressCount = increment(tokenlessPerAddress, address);
    }
    socket.on("disconnect", () => {
      decrement(socketsPerAddress, address);
      if (!claims) {
        tokenlessTotal -= 1;
        decrement(tokenlessPerAddress, address);
      }
    });

    // A socket that never joins a room still costs a file descriptor, an
    // Engine.IO session, and heartbeat traffic. Admitted sockets join inside
    // this handler, so anything still roomless when this fires is a probe that
    // outstayed its purpose or a client holding the connection open for nothing.
    const idleTimer = setTimeout(() => {
      if (socket.data.admittedRoom) return;
      emitProtocolError(socket, claims?.sessionId ?? "unknown", "IDLE_NO_ROOM", "Connection closed: no room was joined.");
      socket.disconnect(true);
    }, limits.unjoinedSocketGraceMs);
    idleTimer.unref?.();
    socket.on("disconnect", () => clearTimeout(idleTimer));

    if (addressCount > limits.maxSocketsPerIp) {
      emitProtocolError(socket, claims?.sessionId ?? "unknown", "TOO_MANY_CONNECTIONS", "Too many connections from this address.");
      socket.disconnect(true);
      return;
    }

    if (!claims && (tokenlessTotal > limits.maxTokenlessSockets || tokenlessAddressCount > limits.maxTokenlessSocketsPerIp)) {
      // Tokenless sockets exist so a platform health probe can reach the relay
      // without minting a room token. That is a narrow purpose and it gets a
      // narrow budget; without one, anyone can hold open as many sockets as the
      // process has descriptors.
      emitProtocolError(socket, "unknown", "TOO_MANY_CONNECTIONS", "Too many unauthenticated connections.");
      socket.disconnect(true);
      return;
    }

    socket.on(SOCKET_EVENTS.foundationPing, (payload: unknown) => {
      const parsed = foundationPingSchema.safeParse(payload);
      if (!parsed.success) return;
      if (!allowAction(rateState, SOCKET_EVENTS.foundationPing, limits.foundationPingPerMinute)) return;
      socket.emit(SOCKET_EVENTS.foundationPong, {
        v: SOCKET_PROTOCOL_VERSION,
        sentAt: parsed.data.sentAt,
        receivedAt: Date.now(),
      });
    });

    if (claims && admittedRoom) {
      if (isRoomRevoked(claims.sessionId)) {
        emitProtocolError(socket, claims.sessionId, "ROOM_REVOKED", "This classroom has ended.");
        socket.disconnect(true);
        return;
      }
      // A room is one physical classroom; a count far above any real class size
      // means abuse or a reconnect storm, and admitting it would let one room
      // exhaust the process for every other class on the relay.
      const occupancy = io.sockets.adapter.rooms.get(admittedRoom)?.size ?? 0;
      if (claims.role === "student" && occupancy >= limits.maxSocketsPerRoom) {
        emitProtocolError(socket, claims.sessionId, "ROOM_FULL", "This classroom is at capacity.");
        socket.disconnect(true);
        return;
      }
      if (claims.role === "teacher") {
        const existingWriter = activeTeacherWriters.get(claims.sessionId);
        if (existingWriter && existingWriter.socketId !== socket.id && existingWriter.subjectId !== claims.subjectId) {
          emitProtocolError(socket, claims.sessionId, "WRITER_ALREADY_ACTIVE", "Another teacher is already editing this room.");
          socket.disconnect(true);
          return;
        }
        // Record the new lease before evicting the old socket, so the old
        // socket's disconnect handler sees it no longer owns the lease.
        activeTeacherWriters.set(claims.sessionId, { socketId: socket.id, subjectId: claims.subjectId });
        if (existingWriter && existingWriter.socketId !== socket.id) {
          // Same teacher, newer socket: the reconnect usually lands before the
          // relay has noticed the old socket is gone. Rejecting it here left the
          // teacher offline for good, because Socket.IO never auto-reconnects
          // after a server-side disconnect. The stale socket is told why it is
          // being closed so that tab can say so instead of offering a Reconnect
          // that would take the board back.
          const staleWriter = io.sockets.sockets.get(existingWriter.socketId);
          if (staleWriter) {
            emitProtocolError(staleWriter, claims.sessionId, "WRITER_REPLACED", "This board was opened in another tab.");
            staleWriter.disconnect(true);
          }
        }
      }
      // Admission is implicit after the verified handshake. The client event below is
      // retained for protocol observability, but never controls the room identity.
      void Promise.resolve(socket.join(admittedRoom)).then(() => schedulePresence(claims.sessionId));
      socket.data.admittedRoom = admittedRoom;
      socket.data.sessionId = claims.sessionId;
      socket.data.role = claims.role;
    }

    socket.on(SOCKET_EVENTS.roomJoin, (payload: unknown) => {
      const parsed = roomJoinSchema.safeParse(payload);
      const currentClaims = socket.data.roomClaims as RoomClaims | undefined;
      if (!parsed.success) {
        emitProtocolError(socket, currentClaims?.sessionId ?? "unknown", "INVALID_PAYLOAD", "Invalid room join payload.");
        return;
      }
      if (!currentClaims) {
        emitProtocolError(socket, parsed.data.sessionId, "UNAUTHORIZED", "A signed room token is required.");
        return;
      }
      if (parsed.data.sessionId !== currentClaims.sessionId) {
        emitProtocolError(socket, currentClaims.sessionId, "ROOM_MISMATCH", "This token is not valid for that room.");
        return;
      }
      // Rejoining is legitimate after a reconnect and pathological in a loop.
      if (!allowAction(rateState, SOCKET_EVENTS.roomJoin, limits.roomJoinPerMinute)) {
        emitProtocolError(socket, currentClaims.sessionId, "RATE_LIMITED", "Too many room join attempts.");
        return;
      }
      const room = roomName(currentClaims.sessionId);
      void Promise.resolve(socket.join(room)).then(() => schedulePresence(currentClaims.sessionId));
    });

    attachClassroomHandlers(io, socket, { verifyToken: (token) => verifyRoomToken(token) });

    socket.on("disconnect", () => {
      // Only release a lease this socket still holds; a same-teacher takeover
      // has already moved it to the newer socket.
      if (claims?.role === "teacher" && activeTeacherWriters.get(claims.sessionId)?.socketId === socket.id) {
        activeTeacherWriters.delete(claims.sessionId);
      }
      if (claims) schedulePresence(claims.sessionId);
    });
  });

  return io;
}
