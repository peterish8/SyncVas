/**
 * @phase 2
 * Board socket sync hook
 *
 * Connect Socket.IO with room token (auth.token = SVRT1).
 * Teacher: emit board:update with SOCKET_PROTOCOL_VERSION + scene + version; a
 *   version is committed only once the relay acknowledges it.
 * Student: listen board:current / board:update; apply any strictly newer version
 *   (every update carries the full scene, so a skipped version needs no resync).
 * Tokens renew in band (auth:refresh) on the same socket. The socket is never
 *   rebuilt just because its admission token rotated.
 * Server rejects student board:update — client must still not send them.
 * Keep latest applied version in a ref; never write HF pointers to Convex.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { TRANSIENT_SYNC_ERROR_TTL_MS, classifySyncError, isClassEndedError } from "@/lib/board-sync-errors";
import {
  isTokenRefreshDue,
  mayRefreshAfterHandshakeFailure,
  nextVersionAfterAck,
  shouldApplyBoardVersion,
  tokenRefreshDelayMs,
} from "@/lib/board-sync-logic";
import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  authRefreshAckSchema,
  boardCurrentSchema,
  boardUpdateAckSchema,
  boardUpdateSchema,
  blockHighlightSchema,
  protocolErrorSchema,
  teacherViewportSchema,
  type BoardUpdateAck,
  type TeacherViewport,
  type BlockHighlight,
} from "@/shared/protocol/socket";

export type BoardSyncRole = "teacher" | "student";

export type BoardSyncStatus = "idle" | "connecting" | "connected" | "offline" | "ended";

/** Called exactly once per publish: with the relay's ack, a timeout, or the disconnect that cut it off. */
export type PublishAcknowledgement = (result: BoardUpdateAck) => void;

/** What the relay reported on (re)connect, for the writer to reconcile against. */
export type BoardCurrentInfo = {
  serverVersion: number;
  /** The locally committed version before this report was applied. */
  previousLocalVersion: number;
  serverHasElements: boolean;
};

/**
 * Socket.IO silently drops a plain ack callback when the socket disconnects, so
 * every acked emit here carries a timeout. Without one, a publish in flight at a
 * disconnect never answered and the teacher's board stopped syncing for good.
 */
const ACK_TIMEOUT_MS = 5_000;

type ConnectionState = { key: string; phase: "connecting" | "connected" | "offline" };
type SyncError = { key: string; code: string | null; message: string };

const socketUrl = () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001";

function sceneHasElements(scene: unknown): boolean {
  if (!scene || typeof scene !== "object") return false;
  const elements = (scene as { elements?: unknown }).elements;
  return Array.isArray(elements) && elements.length > 0;
}

export function useBoardSync(args: {
  sessionId: string;
  role: BoardSyncRole;
  /** Phase 2 proof / Phase 3+ Convex-issued short-lived admission token */
  roomToken?: string;
  /** Reissue a fresh Convex token without exposing token authority to the socket. */
  refreshRoomToken?: () => Promise<string>;
  /** Apply a remote scene when version is accepted */
  onRemoteScene?: (scene: unknown, boardVersion: number, files?: BinaryFiles) => void;
  /** Every board:current, after any newer scene in it has been applied. */
  onBoardCurrent?: (info: BoardCurrentInfo) => void;
  /** Student: lossy teacher camera frames (never mutates board version). */
  onTeacherViewport?: (viewport: TeacherViewport) => void;
  onBlockHighlight?: (highlight: BlockHighlight) => void;
}) {
  const {
    sessionId,
    role,
    roomToken,
    refreshRoomToken,
    onRemoteScene,
    onBoardCurrent,
    onTeacherViewport,
    onBlockHighlight,
  } = args;

  // A refreshed token is tagged with the prop it replaced, so a new prop wins by derivation.
  const [tokenState, setTokenState] = useState<{ source: string | undefined; token: string | undefined }>({
    source: roomToken,
    token: roomToken,
  });
  const activeToken = tokenState.source === roomToken ? tokenState.token : roomToken;
  const hasToken = Boolean(activeToken);

  // Connection state is tagged with the socket it belongs to, so a new session
  // reads as "connecting" by derivation rather than by resetting state in an effect.
  const socketKey = `${sessionId}:${role}`;
  const [connection, setConnection] = useState<ConnectionState>({ key: socketKey, phase: "connecting" });
  const [syncError, setSyncError] = useState<SyncError | null>(null);
  const [endedKey, setEndedKey] = useState<string | null>(null);
  const phase = connection.key === socketKey ? connection.phase : "connecting";
  const status: BoardSyncStatus = endedKey === socketKey ? "ended" : activeToken ? phase : "idle";
  const error = syncError?.key === socketKey ? syncError.message : null;

  const [latestVersion, setLatestVersion] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const latestVersionRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<string> | null>(null);
  /** The token the next handshake presents, and when this client received it (its own clock). */
  const tokenRef = useRef<string | undefined>(undefined);
  const tokenReceivedAtRef = useRef(0);
  /** The token the live socket was admitted or last renewed with. */
  const socketTokenRef = useRef<string | undefined>(undefined);
  const endedRef = useRef(false);
  const lastHandshakeRefreshAtRef = useRef<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  // Latest-callback refs are written after render, never during it.
  const onRemoteSceneRef = useRef(onRemoteScene);
  const onBoardCurrentRef = useRef(onBoardCurrent);
  const onTeacherViewportRef = useRef(onTeacherViewport);
  const onBlockHighlightRef = useRef(onBlockHighlight);
  const refreshRoomTokenRef = useRef(refreshRoomToken);
  const roomTokenRef = useRef(roomToken);
  useEffect(() => {
    onRemoteSceneRef.current = onRemoteScene;
    onBoardCurrentRef.current = onBoardCurrent;
    onTeacherViewportRef.current = onTeacherViewport;
    onBlockHighlightRef.current = onBlockHighlight;
    refreshRoomTokenRef.current = refreshRoomToken;
    roomTokenRef.current = roomToken;
  });

  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
    };
  }, []);

  /** The class is over: stop reconnecting and renewing, and say so. */
  const markEnded = useCallback(() => {
    endedRef.current = true;
    setEndedKey(socketKey);
    socketRef.current?.disconnect();
  }, [socketKey]);

  /** Transient codes clear themselves; anything else stays until the connection recovers. */
  const reportError = useCallback(
    (code: string | null, message: string) => {
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      const next: SyncError = { key: socketKey, code, message };
      setSyncError(next);
      if (code && classifySyncError(code) === "transient") {
        errorTimerRef.current = window.setTimeout(() => {
          errorTimerRef.current = null;
          setSyncError((current) => (current === next ? null : current));
        }, TRANSIENT_SYNC_ERROR_TTL_MS);
      }
    },
    [socketKey],
  );

  /** A frame that succeeded proves any transient refusal before it is over. */
  const clearTransientError = useCallback(() => {
    setSyncError((current) =>
      current?.code && classifySyncError(current.code) === "transient" ? null : current,
    );
  }, []);

  const refreshToken = useCallback(async () => {
    const request = refreshRoomTokenRef.current;
    if (!request) throw new Error("A fresh room token is unavailable.");
    if (endedRef.current) throw new Error("This classroom has ended.");
    if (!refreshInFlightRef.current) {
      const source = roomTokenRef.current;
      refreshInFlightRef.current = request()
        .then((nextToken) => {
          setTokenState({ source, token: nextToken });
          return nextToken;
        })
        .catch((refreshError: unknown) => {
          // Convex refuses a token once the session has ended; that is the
          // class closing, not a connection problem to retry.
          if (isClassEndedError(refreshError)) markEnded();
          throw refreshError;
        })
        .finally(() => {
          refreshInFlightRef.current = null;
        });
    }
    return await refreshInFlightRef.current;
  }, [markEnded]);

  const envelope = useCallback(
    () => ({
      v: SOCKET_PROTOCOL_VERSION,
      sessionId,
      ts: Date.now(),
    }),
    [sessionId],
  );

  const requestCurrent = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit(SOCKET_EVENTS.boardRequestCurrent, envelope());
  }, [envelope]);

  const publishScene = useCallback(
    (scene: unknown, files?: BinaryFiles, acknowledge?: PublishAcknowledgement) => {
      if (role !== "teacher") return false;
      const socket = socketRef.current;
      if (!socket?.connected) return false;
      // Proposed, not committed: a rejected update must not burn a version, or
      // every student sees a skip and the writer drifts from the relay.
      const boardVersion = latestVersionRef.current + 1;
      socket.timeout(ACK_TIMEOUT_MS).emit(
        SOCKET_EVENTS.boardUpdate,
        {
          ...envelope(),
          boardVersion,
          scene,
          ...(files && Object.keys(files).length > 0 ? { files } : {}),
        },
        (err: Error | null, response: unknown) => {
          const parsed = boardUpdateAckSchema.safeParse(response);
          const result: BoardUpdateAck = err
            ? { ok: false, code: "ACK_TIMEOUT" }
            : parsed.success
              ? parsed.data
              : { ok: false, code: "INVALID_PAYLOAD" };
          const committed = nextVersionAfterAck(latestVersionRef.current, result);
          if (committed !== latestVersionRef.current) {
            latestVersionRef.current = committed;
            setLatestVersion(committed);
          }
          if (result.ok) clearTransientError();
          acknowledge?.(result);
        },
      );
      return true;
    },
    [clearTransientError, envelope, role],
  );

  /** Ephemeral teacher camera — does not bump boardVersion. */
  const publishViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number; pageId?: string }) => {
      if (role !== "teacher") return;
      const socket = socketRef.current;
      if (!socket?.connected) return;
      socket.emit(SOCKET_EVENTS.teacherViewport, {
        ...envelope(),
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
        ...(viewport.pageId !== undefined ? { pageId: viewport.pageId } : {}),
      });
    },
    [envelope, role],
  );

  const publishBlockHighlight = useCallback((highlight: Pick<BlockHighlight, "blockId" | "startLine" | "endLine">) => {
    if (role !== "teacher") return;
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit(SOCKET_EVENTS.blockHighlight, { ...envelope(), ...highlight });
  }, [envelope, role]);

  // Adopt each new token. Declared before the socket effect so the first
  // handshake already sees it. A live socket renews in band; a socket the relay
  // refused is reopened, since the fresh token is what it was waiting for.
  useEffect(() => {
    tokenRef.current = activeToken;
    tokenReceivedAtRef.current = Date.now();
    const socket = socketRef.current;
    if (!activeToken || !socket || endedRef.current) return;
    if (!socket.connected) {
      if (!socket.active) socket.connect();
      return;
    }
    if (socketTokenRef.current === activeToken) return;
    socket.timeout(ACK_TIMEOUT_MS).emit(
      SOCKET_EVENTS.authRefresh,
      { v: SOCKET_PROTOCOL_VERSION, sessionId, ts: Date.now(), token: activeToken },
      (err: Error | null, response: unknown) => {
        const parsed = authRefreshAckSchema.safeParse(response);
        if (!err && parsed.success && parsed.data.ok) {
          socketTokenRef.current = activeToken;
          return;
        }
        if (parsed.success && !parsed.data.ok && classifySyncError(parsed.data.code) === "ended") {
          markEnded();
          return;
        }
        // A relay that cannot renew in band still admits the fresh token at a
        // new handshake, which the auth callback supplies.
        if (socketRef.current === socket && !endedRef.current) {
          socket.disconnect();
          socket.connect();
        }
      },
    );
  }, [activeToken, markEnded, sessionId]);

  useEffect(() => {
    if (!hasToken) return;
    endedRef.current = false;

    const socket = io(socketUrl(), {
      transports: ["websocket"],
      // Read at every handshake, so automatic reconnects present the freshest token.
      auth: (callback) => callback({ token: tokenRef.current }),
      reconnection: true,
    });
    socketRef.current = socket;

    const applyIfNewer = (scene: unknown, boardVersion: number, files?: BinaryFiles) => {
      if (!shouldApplyBoardVersion(boardVersion, latestVersionRef.current)) return;
      latestVersionRef.current = boardVersion;
      setLatestVersion(boardVersion);
      onRemoteSceneRef.current?.(scene, boardVersion, files);
    };

    socket.on("connect", () => {
      socketTokenRef.current = tokenRef.current;
      lastHandshakeRefreshAtRef.current = null;
      setConnection({ key: socketKey, phase: "connected" });
      setSyncError(null);
      socket.emit(SOCKET_EVENTS.boardRequestCurrent, envelope());
    });
    socket.on("disconnect", () => {
      setConnection({ key: socketKey, phase: "offline" });
    });
    socket.on("connect_error", (err: Error) => {
      setConnection({ key: socketKey, phase: "offline" });
      reportError(null, err.message || "Socket connection failed.");
      // Transport failures leave the socket active and Socket.IO retries on its
      // own. A handshake the relay refused (an expired or stale stored token)
      // stays down, so mint a fresh token — at most once per cooldown, which is
      // measured on elapsed time because a wrong device clock misreads expiry.
      if (socket.active || endedRef.current || !refreshRoomTokenRef.current) return;
      const now = Date.now();
      if (!mayRefreshAfterHandshakeFailure(lastHandshakeRefreshAtRef.current, now)) return;
      lastHandshakeRefreshAtRef.current = now;
      void refreshToken().catch(() => undefined);
    });

    socket.on(SOCKET_EVENTS.boardCurrent, (payload: unknown) => {
      const parsed = boardCurrentSchema.safeParse(payload);
      if (!parsed.success || parsed.data.sessionId !== sessionId) return;
      const previousLocalVersion = latestVersionRef.current;
      applyIfNewer(parsed.data.scene, parsed.data.boardVersion, parsed.data.files as BinaryFiles | undefined);
      clearTransientError();
      if (parsed.data.teacherViewport) onTeacherViewportRef.current?.(parsed.data.teacherViewport);
      onBoardCurrentRef.current?.({
        serverVersion: parsed.data.boardVersion,
        previousLocalVersion,
        serverHasElements: sceneHasElements(parsed.data.scene),
      });
    });

    socket.on(SOCKET_EVENTS.boardUpdate, (payload: unknown) => {
      const parsed = boardUpdateSchema.safeParse(payload);
      if (!parsed.success || parsed.data.sessionId !== sessionId) return;
      applyIfNewer(parsed.data.scene, parsed.data.boardVersion, parsed.data.files as BinaryFiles | undefined);
    });

    socket.on(SOCKET_EVENTS.teacherViewport, (payload: unknown) => {
      const parsed = teacherViewportSchema.safeParse(payload);
      if (!parsed.success || parsed.data.sessionId !== sessionId) return;
      onTeacherViewportRef.current?.(parsed.data);
    });

    socket.on(SOCKET_EVENTS.blockHighlight, (payload: unknown) => {
      const parsed = blockHighlightSchema.safeParse(payload);
      if (parsed.success && parsed.data.sessionId === sessionId) onBlockHighlightRef.current?.(parsed.data);
    });

    socket.on(SOCKET_EVENTS.protocolError, (payload: unknown) => {
      const parsed = protocolErrorSchema.safeParse(payload);
      if (!parsed.success || parsed.data.sessionId !== sessionId) return;
      reportError(parsed.data.code, parsed.data.message);
      if (classifySyncError(parsed.data.code) === "ended") {
        markEnded();
        return;
      }
      if (parsed.data.code === "TOKEN_EXPIRED") {
        void refreshToken().catch(() => undefined);
      }
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [clearTransientError, envelope, hasToken, markEnded, refreshToken, reportError, sessionId, socketKey]);

  // Renew ahead of expiry, measured from receipt on this client's own clock.
  useEffect(() => {
    if (!activeToken || !refreshRoomTokenRef.current) return;
    const renew = () => {
      void refreshToken().catch(() => undefined);
    };
    const timer = window.setTimeout(renew, tokenRefreshDelayMs(tokenReceivedAtRef.current, Date.now()));
    // Hidden tabs throttle timers; catch up as soon as the tab is visible again.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && isTokenRefreshDue(tokenReceivedAtRef.current, Date.now())) {
        renew();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeToken, refreshToken]);

  const reconnect = useCallback(() => {
    if (endedRef.current) return;
    const socket = socketRef.current;
    setConnection({ key: socketKey, phase: "connecting" });
    // A refused handshake only recovers with a fresh token, and the device clock
    // cannot be trusted to say whether this one lapsed — so renew first. The
    // token effect reopens the socket; this covers a renewal that fails.
    void refreshToken()
      .catch(() => undefined)
      .finally(() => {
        if (socket && socketRef.current === socket && !socket.connected && !endedRef.current) socket.connect();
      });
  }, [refreshToken, socketKey]);

  return {
    status,
    latestVersion,
    publishScene,
    publishViewport,
    publishBlockHighlight,
    requestCurrent,
    reconnect,
    error,
  };
}
