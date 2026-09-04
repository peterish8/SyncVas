"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  AppState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardCurrentSchema,
  boardUpdateSchema,
  protocolErrorSchema,
  teacherViewportSchema,
} from "@/shared/protocol/socket";

import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((module) => module.Excalidraw),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-ink-muted">Loading canvas…</div> },
);

type BoardCanvasProps = {
  sessionId: string;
  role: "teacher" | "student";
  teacherProofToken?: string;
};

type SceneData = {
  elements: ExcalidrawElement[];
  appState?: Pick<AppState, "viewBackgroundColor">;
};

function sceneData(value: unknown): SceneData {
  if (!value || typeof value !== "object") return { elements: [] };
  const source = value as { elements?: unknown; appState?: unknown };
  return {
    elements: Array.isArray(source.elements) ? (source.elements as ExcalidrawElement[]) : [],
    appState:
      source.appState && typeof source.appState === "object" && "viewBackgroundColor" in source.appState
        ? { viewBackgroundColor: String((source.appState as { viewBackgroundColor?: unknown }).viewBackgroundColor) }
        : undefined,
  };
}

const socketUrl = () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001";

export function BoardCanvas({ sessionId, role, teacherProofToken }: BoardCanvasProps) {
  const isTeacher = role === "teacher";
  const socketRef = useRef<Socket | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const boardVersionRef = useRef(0);
  const applyingRemoteRef = useRef(false);
  const pendingRef = useRef<{ elements: readonly ExcalidrawElement[]; appState: AppState } | null>(null);
  const broadcastTimerRef = useRef<number | null>(null);
  const broadcastPendingRef = useRef<(() => void) | null>(null);
  const resyncRequestedRef = useRef(false);
  const [connection, setConnection] = useState<"connecting" | "connected" | "offline">("connecting");
  const [boardVersion, setBoardVersion] = useState(0);
  const [studentViewport, setStudentViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [error, setError] = useState<string | null>(null);

  const applyScene = useCallback((scene: unknown, version: number) => {
    if (version <= boardVersionRef.current && version !== 0) return;
    const parsed = sceneData(scene);
    boardVersionRef.current = version;
    setBoardVersion(version);
    const api = apiRef.current;
    if (!api) return;
    applyingRemoteRef.current = true;
    api.updateScene({ elements: parsed.elements, captureUpdate: "NEVER" });
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    const socket = io(socketUrl(), {
      transports: ["websocket"],
      auth: {
        sessionId,
        // The server derives role from this capability, never from this field.
        role,
        ...(isTeacher && teacherProofToken ? { proofToken: teacherProofToken } : {}),
      },
      reconnection: true,
    });
    socketRef.current = socket;

    const envelope = () => ({ v: SOCKET_PROTOCOL_VERSION as 1, sessionId, ts: Date.now() });
    const requestCurrent = () => socket.emit(SOCKET_EVENTS.boardRequestCurrent, envelope());

    socket.on("connect", () => {
      setConnection("connected");
      resyncRequestedRef.current = false;
      requestCurrent();
    });
    socket.on("disconnect", () => setConnection("offline"));
    socket.on("connect_error", () => setConnection("offline"));
    socket.on(SOCKET_EVENTS.boardCurrent, (payload: unknown) => {
      const parsed = boardCurrentSchema.safeParse(payload);
      if (parsed.success && parsed.data.sessionId === sessionId) {
        resyncRequestedRef.current = false;
        applyScene(parsed.data.scene, parsed.data.boardVersion);
        // A teacher may have drawn while the socket was reconnecting. Wait for
        // the canonical bootstrap to settle before assigning the next version.
        if (isTeacher) window.setTimeout(() => broadcastPendingRef.current?.(), 0);
      }
    });
    socket.on(SOCKET_EVENTS.boardUpdate, (payload: unknown) => {
      const parsed = boardUpdateSchema.safeParse(payload);
      if (parsed.success && parsed.data.sessionId === sessionId) {
        if (parsed.data.boardVersion > boardVersionRef.current + 1) {
          if (!resyncRequestedRef.current) {
            resyncRequestedRef.current = true;
            requestCurrent();
          }
        } else {
          applyScene(parsed.data.scene, parsed.data.boardVersion);
        }
      }
    });
    socket.on(SOCKET_EVENTS.protocolError, (payload: unknown) => {
      const parsed = protocolErrorSchema.safeParse(payload);
      if (parsed.success && parsed.data.sessionId === sessionId) setError(parsed.data.message);
    });

    return () => {
      if (broadcastTimerRef.current !== null) window.clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = null;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [applyScene, isTeacher, role, sessionId, teacherProofToken]);

  const broadcastPending = useCallback(() => {
    const pending = pendingRef.current;
    const socket = socketRef.current;
    if (!pending || !socket || !socket.connected || !isTeacher) return;
    pendingRef.current = null;
    const boardVersion = boardVersionRef.current + 1;
    boardVersionRef.current = boardVersion;
    setBoardVersion(boardVersion);
    socket.emit(SOCKET_EVENTS.boardUpdate, {
      ...({ v: SOCKET_PROTOCOL_VERSION as 1, sessionId, ts: Date.now() }),
      boardVersion,
      scene: { elements: pending.elements, appState: { viewBackgroundColor: pending.appState.viewBackgroundColor } },
    });
  }, [isTeacher, sessionId]);

  broadcastPendingRef.current = broadcastPending;

  const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    if (!isTeacher || applyingRemoteRef.current) return;
    // Image insertion is disabled until binary file synchronization exists.
    void files;
    pendingRef.current = { elements, appState };
    if (broadcastTimerRef.current === null) {
      broadcastPending();
      broadcastTimerRef.current = window.setTimeout(() => {
        broadcastTimerRef.current = null;
        broadcastPending();
      }, 50);
    }
  }, [broadcastPending, isTeacher]);

  const onStudentScrollChange = useCallback((x: number, y: number, zoom: AppState["zoom"]) => {
    // Excalidraw owns this camera. Keeping the latest value in React state
    // makes the locality explicit and, importantly, never emits a socket event.
    setStudentViewport({ x, y, zoom: zoom.value });
  }, []);

  const onScrollChange = useCallback((scrollX: number, scrollY: number, zoom: AppState["zoom"]) => {
    if (!isTeacher || applyingRemoteRef.current) return;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.volatile.emit(SOCKET_EVENTS.teacherViewport, {
        v: SOCKET_PROTOCOL_VERSION as 1,
        sessionId,
        ts: Date.now(),
        x: scrollX,
        y: scrollY,
        zoom: zoom.value,
      });
    }
  }, [isTeacher, sessionId]);

  return (
    <div className="relative h-full min-h-[32rem] overflow-hidden rounded-2xl border border-border bg-white">
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        onChange={isTeacher ? onChange : undefined}
        onScrollChange={isTeacher ? onScrollChange : onStudentScrollChange}
        viewModeEnabled={!isTeacher}
        UIOptions={{
          canvasActions: isTeacher
            ? undefined
            : { clearCanvas: false, export: false, loadScene: false, saveToActiveFile: false, toggleTheme: false, changeViewBackgroundColor: false },
          // Binary file synchronization is intentionally deferred; keep image
          // insertion out of the proof so scene JSON remains canonical.
          tools: { image: false },
        }}
        zenModeEnabled={false}
        autoFocus={isTeacher}
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-border bg-white/90 px-3 py-1 text-xs font-medium shadow-sm">
        {isTeacher ? "Teacher canvas" : "Read-only view"} · v{boardVersion}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 flex gap-2 text-xs text-ink-muted">
        <span className={`rounded-full px-2 py-1 ${connection === "connected" ? "bg-[#e8f5e9] text-[#216e39]" : "bg-surface-muted"}`}>{connection}</span>
        {!isTeacher ? <span className="rounded-full bg-surface-muted px-2 py-1">local view · {Math.round(studentViewport.zoom * 100)}%</span> : null}
        {error ? <span className="rounded-full bg-[#fff1ed] px-2 py-1 text-[#a33b2c]">{error}</span> : null}
      </div>
    </div>
  );
}
