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
import { clearHotScene, isRoomRevoked, markRoomRevoked } from "./board-hot-state.js";

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

export function roomName(sessionId: string): string {
  return `session:${sessionId}`;
}

function emitPresence(io: Server, sessionId: string): void {
  const room = roomName(sessionId);
  const connectedCount = io.sockets.adapter.rooms.get(room)?.size ?? 0;
  io.to(room).emit(SOCKET_EVENTS.roomPresence, {
    v: SOCKET_PROTOCOL_VERSION,
    sessionId,
    ts: Date.now(),
    connectedCount,
  });
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

export function createSocketServer(httpServer: HttpServer, allowedOrigins: string[]) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
  });
  const activeTeacherWriters = new Map<string, string>();

  const revokeRoom = (sessionId: string) => {
    markRoomRevoked(sessionId);
    const room = roomName(sessionId);
    for (const socket of io.sockets.adapter.rooms.get(room) ? io.sockets.sockets.values() : []) {
      const claims = socket.data.roomClaims as RoomClaims | undefined;
      if (claims?.sessionId === sessionId) {
        emitProtocolError(socket, sessionId, "ROOM_REVOKED", "This classroom has ended.");
        socket.disconnect(true);
      }
    }
    activeTeacherWriters.delete(sessionId);
    clearHotScene(sessionId);
  };

  // Private Convex callback. It is intentionally attached to the existing
  // server and authenticated with the same secret used for room tokens.
  httpServer.on("request", (request, response) => {
    if (request.method !== "POST" || request.url !== "/internal/revoke-room") return;
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

    socket.on(SOCKET_EVENTS.foundationPing, (payload: unknown) => {
      const parsed = foundationPingSchema.safeParse(payload);
      if (!parsed.success) return;
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
      if (claims.role === "teacher") {
        const existingWriter = activeTeacherWriters.get(claims.sessionId);
        if (existingWriter && existingWriter !== socket.id) {
          emitProtocolError(socket, claims.sessionId, "WRITER_ALREADY_ACTIVE", "Another teacher is already editing this room.");
          socket.disconnect(true);
          return;
        }
        activeTeacherWriters.set(claims.sessionId, socket.id);
      }
      // Admission is implicit after the verified handshake. The client event below is
      // retained for protocol observability, but never controls the room identity.
      void Promise.resolve(socket.join(admittedRoom)).then(() => emitPresence(io, claims.sessionId));
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
      const room = roomName(currentClaims.sessionId);
      void Promise.resolve(socket.join(room)).then(() => emitPresence(io, currentClaims.sessionId));
    });

    attachClassroomHandlers(io, socket);

    socket.on("disconnect", () => {
      if (claims?.role === "teacher" && activeTeacherWriters.get(claims.sessionId) === socket.id) {
        activeTeacherWriters.delete(claims.sessionId);
      }
      if (claims) emitPresence(io, claims.sessionId);
    });
  });

  return io;
}
