/**
 * Classroom event handlers.
 *
 * Phase 2: board:update (teacher only), board:request-current → board:current.
 * Phase 4 prep: teacher:viewport forward latest only; lossy OK.
 * Reject student board:update; validate envelopes; protocol:error codes from docs/28.
 */

import type { Server, Socket } from "socket.io";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardRequestCurrentSchema,
  boardUpdateSchema,
  blockHighlightSchema,
  teacherViewportSchema,
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
  exp: number;
};

type BoardUpdateAck = (result: { ok: true; boardVersion: number } | { ok: false; code: string }) => void;

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
  const fromToken = socket.data.roomClaims as SocketClaims | undefined;
  if (fromToken?.sessionId && (fromToken.role === "teacher" || fromToken.role === "student")) {
    return { sessionId: fromToken.sessionId, role: fromToken.role, exp: fromToken.exp };
  }
  return undefined;
}

function requireLiveClaims(socket: Socket, sessionId: string): SocketClaims | undefined {
  const claims = getClaims(socket);
  if (!claims) {
    emitProtocolError(socket, sessionId, "UNAUTHORIZED", "A signed room token is required.");
    return undefined;
  }
  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    emitProtocolError(socket, claims.sessionId, "TOKEN_EXPIRED", "The room token has expired. Reconnect with a fresh token.");
    return undefined;
  }
  if (isRoomRevoked(claims.sessionId)) {
    emitProtocolError(socket, claims.sessionId, "ROOM_REVOKED", "This classroom has ended.");
    return undefined;
  }
  return claims;
}

export function attachClassroomHandlers(io: Server, socket: Socket): void {
  void io;
  const rateState: RateLimitState = createRateLimitState();

  socket.on(SOCKET_EVENTS.boardUpdate, (payload: unknown, acknowledge?: BoardUpdateAck) => {
    const parsed = boardUpdateSchema.safeParse(payload);
    const claims = getClaims(socket);
    if (!parsed.success) {
      emitProtocolError(
        socket,
        claims?.sessionId ?? "unknown",
        "INVALID_PAYLOAD",
        "Invalid board update payload.",
      );
      acknowledge?.({ ok: false, code: "INVALID_PAYLOAD" });
      return;
    }
    const liveClaims = requireLiveClaims(socket, parsed.data.sessionId);
    if (!liveClaims) return;
    if (parsed.data.sessionId !== liveClaims.sessionId) {
      emitProtocolError(socket, liveClaims.sessionId, "ROOM_MISMATCH", "This token is not valid for that room.");
      acknowledge?.({ ok: false, code: "ROOM_MISMATCH" });
      return;
    }
    if (liveClaims.role !== "teacher") {
      emitProtocolError(
        socket,
        liveClaims.sessionId,
        "STUDENT_BOARD_EDIT_FORBIDDEN",
        "Students cannot mutate the board.",
      );
      acknowledge?.({ ok: false, code: "STUDENT_BOARD_EDIT_FORBIDDEN" });
      return;
    }
    if (!allowAction(rateState, "board:update", LIMITS.boardUpdatePerMinute)) {
      emitProtocolError(socket, liveClaims.sessionId, "RATE_LIMITED", "Too many board updates.");
      acknowledge?.({ ok: false, code: "RATE_LIMITED" });
      return;
    }

    const current = getHotScene(liveClaims.sessionId);
    if (current && parsed.data.boardVersion <= current.version) {
      emitProtocolError(
        socket,
        liveClaims.sessionId,
        "STALE_BOARD_VERSION",
        "Board version is stale.",
      );
      acknowledge?.({ ok: false, code: "STALE_BOARD_VERSION" });
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
    acknowledge?.({ ok: true, boardVersion: parsed.data.boardVersion });
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
    const liveClaims = requireLiveClaims(socket, parsed.data.sessionId);
    if (!liveClaims) return;
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
    const liveClaims = requireLiveClaims(socket, parsed.data.sessionId);
    if (!liveClaims) return;
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
    const liveClaims = requireLiveClaims(socket, parsed.data.sessionId);
    if (!liveClaims || liveClaims.sessionId !== parsed.data.sessionId) return;
    if (liveClaims.role !== "teacher") {
      emitProtocolError(socket, liveClaims.sessionId, "FORBIDDEN", "Only the teacher may highlight a block.");
      return;
    }
    socket.volatile.to(roomName(liveClaims.sessionId)).emit(SOCKET_EVENTS.blockHighlight, parsed.data);
  });
}
