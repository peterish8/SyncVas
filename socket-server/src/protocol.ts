/**
 * Classroom event handlers.
 *
 * Phase 2: board:update (teacher only), board:request-current → board:current.
 * Phase 4 prep: teacher:viewport forward latest only; lossy OK.
 * auth:refresh renews a live socket's claims for the same identity.
 * Reject student board:update; validate envelopes; protocol:error codes from docs/28.
 */

import type { Server, Socket } from "socket.io";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  authRefreshSchema,
  boardRequestCurrentSchema,
  boardUpdateSchema,
  blockHighlightSchema,
  teacherViewportSchema,
  type AuthRefreshAck,
  type BoardUpdateAck,
} from "../../shared/protocol/socket.js";
import { getHotScene, isRoomRevoked, setHotScene, setHotViewport } from "./board-hot-state.js";
import { roomName } from "./rooms.js";
import { LIMITS, loadConfig } from "./config.js";
import { allowAction, createRateLimitState, type RateLimitState } from "./rate-limit.js";

/**
 * `board:update` fires on every coalesced stroke batch and `teacher:viewport` at
 * scroll frame rate, so logging them per event floods production logs and costs
 * real money at any hosted log sink. Opt in with SOCKET_DEBUG_EVENTS=1.
 */
const debugEvents = (() => {
  try {
    return loadConfig().debugEvents;
  } catch {
    return false;
  }
})();

function debugLog(event: string, detail: Record<string, unknown>): void {
  if (debugEvents) console.info(event, detail);
}

type SocketClaims = {
  sessionId: string;
  role: "teacher" | "student";
  subjectId: string;
  exp: number;
};

export type ClassroomHandlerOptions = {
  /** Verifies a presented room token; `server.ts` supplies the SVRT1 verifier. */
  verifyToken?: (token: string) => SocketClaims | null;
};

type LiveClaimsResult = { ok: true; claims: SocketClaims } | { ok: false; code: string };

function emitProtocolError(socket: Socket, sessionId: string, code: string, message: string): void {
  socket.emit(SOCKET_EVENTS.protocolError, {
    v: SOCKET_PROTOCOL_VERSION,
    sessionId,
    ts: Date.now(),
    code,
    message,
  });
}

function getClaims(socket: Socket): SocketClaims | undefined {
  const fromToken = socket.data.roomClaims as Partial<SocketClaims> | undefined;
  if (
    fromToken?.sessionId &&
    (fromToken.role === "teacher" || fromToken.role === "student") &&
    typeof fromToken.exp === "number"
  ) {
    return {
      sessionId: fromToken.sessionId,
      role: fromToken.role,
      subjectId: fromToken.subjectId ?? "",
      exp: fromToken.exp,
    };
  }
  return undefined;
}

/**
 * Resolve the socket's claims, emitting the protocol error on failure.
 *
 * Returns the failure code as well, so a handler that owes the client an
 * acknowledgement can send one. Returning bare `undefined` here used to leave
 * the teacher's publish waiting forever on a rejected update.
 */
function requireLiveClaims(socket: Socket, sessionId: string): LiveClaimsResult {
  const claims = getClaims(socket);
  if (!claims) {
    emitProtocolError(socket, sessionId, "UNAUTHORIZED", "A signed room token is required.");
    return { ok: false, code: "UNAUTHORIZED" };
  }
  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    emitProtocolError(socket, claims.sessionId, "TOKEN_EXPIRED", "The room token has expired. Reconnect with a fresh token.");
    return { ok: false, code: "TOKEN_EXPIRED" };
  }
  if (isRoomRevoked(claims.sessionId)) {
    emitProtocolError(socket, claims.sessionId, "ROOM_REVOKED", "This classroom has ended.");
    return { ok: false, code: "ROOM_REVOKED" };
  }
  return { ok: true, claims };
}

export function attachClassroomHandlers(io: Server, socket: Socket, options: ClassroomHandlerOptions = {}): void {
  void io;
  // `server.ts` installs one budget per socket and shares it here, so a client
  // cannot reset its allowance by moving between event names. The fallback keeps
  // this module independently testable.
  const rateState: RateLimitState =
    (socket.data.rateState as RateLimitState | undefined) ?? createRateLimitState();

  socket.on(SOCKET_EVENTS.boardUpdate, (payload: unknown, acknowledge?: unknown) => {
    // Every exit below acknowledges. The writer holds at most one publish in
    // flight, so a missing reply is not a dropped frame — it is a frozen board.
    const reply = (result: BoardUpdateAck) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const parsed = boardUpdateSchema.safeParse(payload);
    const claims = getClaims(socket);
    if (!parsed.success) {
      emitProtocolError(
        socket,
        claims?.sessionId ?? "unknown",
        "INVALID_PAYLOAD",
        "Invalid board update payload.",
      );
      reply({ ok: false, code: "INVALID_PAYLOAD" });
      return;
    }
    const live = requireLiveClaims(socket, parsed.data.sessionId);
    if (!live.ok) {
      reply({ ok: false, code: live.code });
      return;
    }
    const liveClaims = live.claims;
    if (parsed.data.sessionId !== liveClaims.sessionId) {
      emitProtocolError(socket, liveClaims.sessionId, "ROOM_MISMATCH", "This token is not valid for that room.");
      reply({ ok: false, code: "ROOM_MISMATCH" });
      return;
    }
    if (liveClaims.role !== "teacher") {
      emitProtocolError(
        socket,
        liveClaims.sessionId,
        "STUDENT_BOARD_EDIT_FORBIDDEN",
        "Students cannot mutate the board.",
      );
      reply({ ok: false, code: "STUDENT_BOARD_EDIT_FORBIDDEN" });
      return;
    }
    if (!allowAction(rateState, "board:update", LIMITS.boardUpdatePerMinute)) {
      emitProtocolError(socket, liveClaims.sessionId, "RATE_LIMITED", "Too many board updates.");
      reply({ ok: false, code: "RATE_LIMITED" });
      return;
    }

    const current = getHotScene(liveClaims.sessionId);
    if (current && parsed.data.boardVersion <= current.version) {
      // Not surfaced as a protocol:error: the ack carries the relay's version
      // and the writer recovers on its own, so a banner would only alarm.
      reply({ ok: false, code: "STALE_BOARD_VERSION", boardVersion: current.version });
      return;
    }

    setHotScene(liveClaims.sessionId, {
      version: parsed.data.boardVersion,
      scene: parsed.data.scene,
      files: parsed.data.files,
      updatedAt: Date.now(),
    });

    const room = roomName(liveClaims.sessionId);
    debugLog(SOCKET_EVENTS.boardUpdate, { sessionId: liveClaims.sessionId, room });
    socket.to(room).emit(SOCKET_EVENTS.boardUpdate, parsed.data);
    reply({ ok: true, boardVersion: parsed.data.boardVersion });
  });

  socket.on(SOCKET_EVENTS.boardRequestCurrent, (payload: unknown) => {
    const parsed = boardRequestCurrentSchema.safeParse(payload);
    const claims = getClaims(socket);
    if (!parsed.success) {
      emitProtocolError(
        socket,
        claims?.sessionId ?? "unknown",
        "INVALID_PAYLOAD",
        "Invalid board request payload.",
      );
      return;
    }
    const live = requireLiveClaims(socket, parsed.data.sessionId);
    if (!live.ok) return;
    const liveClaims = live.claims;
    if (parsed.data.sessionId !== liveClaims.sessionId) {
      emitProtocolError(socket, liveClaims.sessionId, "ROOM_MISMATCH", "This token is not valid for that room.");
      return;
    }

    // One small request makes the server serialize and send the entire scene plus
    // its binary files, so this is the cheapest amplification vector in the relay.
    if (!allowAction(rateState, "board:request-current", LIMITS.requestCurrentPerMinute)) {
      emitProtocolError(socket, liveClaims.sessionId, "RATE_LIMITED", "Too many board refresh requests.");
      return;
    }

    const hot = getHotScene(liveClaims.sessionId);
    debugLog(SOCKET_EVENTS.boardRequestCurrent, {
      sessionId: liveClaims.sessionId,
      room: roomName(liveClaims.sessionId),
    });
    socket.emit(SOCKET_EVENTS.boardCurrent, {
      v: SOCKET_PROTOCOL_VERSION,
      sessionId: liveClaims.sessionId,
      ts: Date.now(),
      boardVersion: hot?.version ?? 0,
      scene: hot?.scene ?? {},
      ...(hot?.files ? { files: hot.files } : {}),
      ...(hot?.viewport
        ? {
            teacherViewport: {
              v: SOCKET_PROTOCOL_VERSION,
              sessionId: liveClaims.sessionId,
              x: hot.viewport.x,
              y: hot.viewport.y,
              zoom: hot.viewport.zoom,
              ...(hot.viewport.pageId ? { pageId: hot.viewport.pageId } : {}),
              ts: hot.viewport.ts,
            },
          }
        : {}),
    });
  });

  socket.on(SOCKET_EVENTS.teacherViewport, (payload: unknown) => {
    const parsed = teacherViewportSchema.safeParse(payload);
    const claims = getClaims(socket);
    if (!parsed.success) {
      emitProtocolError(
        socket,
        claims?.sessionId ?? "unknown",
        "INVALID_PAYLOAD",
        "Invalid viewport payload.",
      );
      return;
    }
    const live = requireLiveClaims(socket, parsed.data.sessionId);
    if (!live.ok) return;
    const liveClaims = live.claims;
    if (parsed.data.sessionId !== liveClaims.sessionId) {
      emitProtocolError(socket, liveClaims.sessionId, "ROOM_MISMATCH", "This token is not valid for that room.");
      return;
    }
    if (liveClaims.role !== "teacher") {
      emitProtocolError(
        socket,
        liveClaims.sessionId,
        "FORBIDDEN",
        "Only the teacher may broadcast viewport.",
      );
      return;
    }

    const room = roomName(liveClaims.sessionId);
    setHotViewport(liveClaims.sessionId, {
      x: parsed.data.x,
      y: parsed.data.y,
      zoom: parsed.data.zoom,
      pageId: parsed.data.pageId,
      ts: parsed.data.ts,
    });
    debugLog(SOCKET_EVENTS.teacherViewport, { sessionId: liveClaims.sessionId, room });
    socket.volatile.to(room).emit(SOCKET_EVENTS.teacherViewport, parsed.data);
  });

  socket.on(SOCKET_EVENTS.blockHighlight, (payload: unknown) => {
    const parsed = blockHighlightSchema.safeParse(payload);
    const claims = getClaims(socket);
    if (!parsed.success) {
      emitProtocolError(socket, claims?.sessionId ?? "unknown", "INVALID_PAYLOAD", "Invalid block highlight payload.");
      return;
    }
    const live = requireLiveClaims(socket, parsed.data.sessionId);
    if (!live.ok || live.claims.sessionId !== parsed.data.sessionId) return;
    if (live.claims.role !== "teacher") {
      emitProtocolError(socket, live.claims.sessionId, "FORBIDDEN", "Only the teacher may highlight a block.");
      return;
    }
    socket.volatile.to(roomName(live.claims.sessionId)).emit(SOCKET_EVENTS.blockHighlight, parsed.data);
  });

  socket.on(SOCKET_EVENTS.authRefresh, (payload: unknown, acknowledge?: unknown) => {
    const reply = (result: AuthRefreshAck) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const parsed = authRefreshSchema.safeParse(payload);
    const current = getClaims(socket);
    if (!parsed.success) {
      reply({ ok: false, code: "INVALID_PAYLOAD" });
      return;
    }
    if (!current) {
      reply({ ok: false, code: "UNAUTHORIZED" });
      return;
    }
    if (parsed.data.sessionId !== current.sessionId) {
      reply({ ok: false, code: "ROOM_MISMATCH" });
      return;
    }
    if (!allowAction(rateState, SOCKET_EVENTS.authRefresh, LIMITS.authRefreshPerMinute)) {
      reply({ ok: false, code: "RATE_LIMITED" });
      return;
    }
    if (isRoomRevoked(current.sessionId)) {
      reply({ ok: false, code: "ROOM_REVOKED" });
      return;
    }
    const next = options.verifyToken?.(parsed.data.token) ?? null;
    if (!next) {
      reply({ ok: false, code: "UNAUTHORIZED" });
      return;
    }
    // A refresh renews the lease on the identity admitted at handshake. It can
    // never move a socket to another room, promote a student, or swap subjects.
    if (
      next.sessionId !== current.sessionId ||
      next.role !== current.role ||
      next.subjectId !== current.subjectId
    ) {
      reply({ ok: false, code: "FORBIDDEN" });
      return;
    }
    socket.data.roomClaims = next;
    reply({ ok: true, exp: next.exp });
  });
}
