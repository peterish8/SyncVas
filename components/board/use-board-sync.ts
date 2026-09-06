/**
 * @phase 2
 * Board socket sync hook
 *
 * Connect Socket.IO with room token (auth.token = SVRT1).
 * Teacher: emit board:update with SOCKET_PROTOCOL_VERSION + scene + version.
 * Student: listen board:current / board:update; ignore older versions.
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
import { parseRoomTokenExpiry } from "@/lib/socket-token";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardCurrentSchema,
  boardUpdateSchema,
  blockHighlightSchema,
  protocolErrorSchema,
  teacherViewportSchema,
  type TeacherViewport,
  type BlockHighlight,
} from "@/shared/protocol/socket";

export type BoardSyncRole = "teacher" | "student";

export type BoardSyncStatus = "idle" | "connecting" | "connected" | "offline";

type ConnectionState = {
  token: string | undefined;
  phase: "connecting" | "connected" | "offline";
  error: string | null;
};

export type PublishAcknowledgement =
  | ((result: { ok: true; boardVersion: number } | { ok: false; code: string }) => void);

const socketUrl = () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001";

export function useBoardSync(args: {
  sessionId: string;
  role: BoardSyncRole;
  /** Phase 2 proof / Phase 3+ Convex-issued short-lived admission token */
  roomToken?: string;
  /** Reissue a fresh Convex token without exposing token authority to the socket. */
  refreshRoomToken?: () => Promise<string>;
  /** Apply a remote scene when version is accepted */
    onRemoteScene?: (scene: unknown, boardVersion: number, files?: BinaryFiles) => void;
  /** Student: lossy teacher camera frames (never mutates board version). */
    onTeacherViewport?: (viewport: TeacherViewport) => void;
    onBlockHighlight?: (highlight: BlockHighlight) => void;
}) {
  const { sessionId, role, roomToken, refreshRoomToken, onRemoteScene, onTeacherViewport, onBlockHighlight } = args;

  const [tokenState, setTokenState] = useState<{ source: string | undefined; token: string | undefined }>({
    source: roomToken,
    token: roomToken,
  });
  const activeToken = tokenState.source === roomToken ? tokenState.token : roomToken;

  // Connection state is tagged with the token it belongs to, so a token change
  // reads as "connecting" by derivation rather than by resetting state in an effect.
  const [connection, setConnection] = useState<ConnectionState>({
    token: roomToken,
    phase: "connecting",
    error: null,
  });
  const fresh = connection.token === activeToken ? connection : null;
  const status: BoardSyncStatus = activeToken ? (fresh?.phase ?? "connecting") : "idle";
  const error = fresh?.error ?? null;

  const [latestVersion, setLatestVersion] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const latestVersionRef = useRef(0);
  const resyncRequestedRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<string> | null>(null);

  // Latest-callback refs are written after render, never during it.
  const onRemoteSceneRef = useRef(onRemoteScene);
  const onTeacherViewportRef = useRef(onTeacherViewport);
  const onBlockHighlightRef = useRef(onBlockHighlight);
  const refreshRoomTokenRef = useRef(refreshRoomToken);
  useEffect(() => {
    onRemoteSceneRef.current = onRemoteScene;
    onTeacherViewportRef.current = onTeacherViewport;
    onBlockHighlightRef.current = onBlockHighlight;
    refreshRoomTokenRef.current = refreshRoomToken;
  });

  const refreshToken = useCallback(async () => {
    const request = refreshRoomTokenRef.current;
    if (!request) throw new Error("A fresh room token is unavailable.");
    if (!refreshInFlightRef.current) {
      refreshInFlightRef.current = request()
        .then((nextToken) => {
          setTokenState({ source: roomToken, token: nextToken });
          return nextToken;
        })
        .finally(() => {
          refreshInFlightRef.current = null;
        });
    }
    return await refreshInFlightRef.current;
  }, [roomToken]);

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
      const boardVersion = latestVersionRef.current + 1;
      latestVersionRef.current = boardVersion;
      setLatestVersion(boardVersion);
      socket.emit(SOCKET_EVENTS.boardUpdate, {
        ...envelope(),
        boardVersion,
        scene,
        ...(files && Object.keys(files).length > 0 ? { files } : {}),
      }, acknowledge);
      return true;
    },
    [envelope, role],
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

  useEffect(() => {
    if (!activeToken) return;

    resyncRequestedRef.current = false;

    const socket = io(socketUrl(), {
      transports: ["websocket"],
      auth: { token: activeToken },
      reconnection: true,
    });
    socketRef.current = socket;

    const applyIfNewer = (scene: unknown, boardVersion: number, files?: BinaryFiles) => {
      if (boardVersion < latestVersionRef.current) return;
      if (boardVersion === latestVersionRef.current && boardVersion !== 0) return;
      latestVersionRef.current = boardVersion;
      setLatestVersion(boardVersion);
      onRemoteSceneRef.current?.(scene, boardVersion, files);
    };

    socket.on("connect", () => {
      setConnection({ token: activeToken, phase: "connected", error: null });
      resyncRequestedRef.current = false;
      socket.emit(SOCKET_EVENTS.boardRequestCurrent, {
        v: SOCKET_PROTOCOL_VERSION,
        sessionId,
        ts: Date.now(),
      });
    });
    socket.on("disconnect", () => {
      setConnection((prev) => ({
        token: activeToken,
        phase: "offline",
        error: prev.token === activeToken ? prev.error : null,
      }));
    });
    socket.on("connect_error", (err: Error) => {
      setConnection({
        token: activeToken,
        phase: "offline",
        error: err.message || "Socket connection failed.",
      });
    });

    socket.on(SOCKET_EVENTS.boardCurrent, (payload: unknown) => {
      const parsed = boardCurrentSchema.safeParse(payload);
      if (!parsed.success || parsed.data.sessionId !== sessionId) return;
      resyncRequestedRef.current = false;
      applyIfNewer(parsed.data.scene, parsed.data.boardVersion, parsed.data.files as BinaryFiles | undefined);
      if (parsed.data.teacherViewport) onTeacherViewportRef.current?.(parsed.data.teacherViewport);
    });

    socket.on(SOCKET_EVENTS.boardUpdate, (payload: unknown) => {
      const parsed = boardUpdateSchema.safeParse(payload);
      if (!parsed.success || parsed.data.sessionId !== sessionId) return;
      const incoming = parsed.data.boardVersion;
      if (incoming > latestVersionRef.current + 1) {
        if (!resyncRequestedRef.current) {
          resyncRequestedRef.current = true;
          socket.emit(SOCKET_EVENTS.boardRequestCurrent, {
            v: SOCKET_PROTOCOL_VERSION,
            sessionId,
            ts: Date.now(),
          });
        }
        return;
      }
      applyIfNewer(parsed.data.scene, incoming, parsed.data.files as BinaryFiles | undefined);
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
      if (parsed.success && parsed.data.sessionId === sessionId) {
        setConnection((prev) => ({
          token: activeToken,
          phase: prev.token === activeToken ? prev.phase : "connecting",
          error: parsed.data.message,
        }));
        if (parsed.data.code === "TOKEN_EXPIRED") {
          void refreshToken().catch(() => undefined);
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeToken, refreshToken, sessionId]);

  useEffect(() => {
    if (!activeToken || !refreshRoomTokenRef.current) return;
    const expiresAt = parseRoomTokenExpiry(activeToken);
    if (!expiresAt) return;
    const refreshAt = Math.max(0, (expiresAt - Math.floor(Date.now() / 1000) - 60) * 1000);
    const timer = window.setTimeout(() => {
      void refreshToken().catch(() => undefined);
    }, refreshAt);
    return () => window.clearTimeout(timer);
  }, [activeToken, refreshToken]);

  return {
    status,
    latestVersion,
    publishScene,
    publishViewport,
    publishBlockHighlight,
    requestCurrent,
    error,
  };
}
