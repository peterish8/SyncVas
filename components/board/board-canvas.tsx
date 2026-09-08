/**
 * @phase 2+4
 * Excalidraw canvas + socket sync
 *
 * Phase 2 IMPLEMENT:
 *   - dynamic import @excalidraw/excalidraw (ssr:false); real container height
 *   - teacher: onChange → throttle → board:update (versioned Zod envelope)
 *   - student: viewModeEnabled / no mutate tools; never emit board:update
 *   - on connect: board:request-current; apply only newer versions; gap → resync
 *   - guard applyingRemote so remote apply does not rebroadcast
 *   - student pan/zoom stays in LOCAL React state only
 * Phase 4 IMPLEMENT:
 *   - teacher coalesce teacher:viewport ~10–15/s
 *   - student follow applies teacher viewport; manual pan exits follow locally
 * NEVER persist pointer streams to Convex. NEVER use refs during render.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  AppState,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, Theme } from "@excalidraw/excalidraw/element/types";

import { useBoardSync } from "@/components/board/use-board-sync";
import {
  useTeacherViewport,
  type TeacherViewportCoords,
} from "@/components/board/use-teacher-viewport";
import { ReconnectBanner } from "@/components/connection/reconnect-banner";
import { FollowControls } from "@/components/student/follow-controls";
import { BOARD_UPDATE_MIN_MS } from "@/shared/constants/limits";
import { THEME_CHANGE_EVENT } from "@/components/ui/theme-toggle";
import { BlockPanel } from "@/components/blocks/block-panel";
import type { BlockCompileResult } from "@/lib/blocks/types";
import { boardSyncStatusLabel } from "@/lib/user-facing-errors";
import type { BlockHighlight } from "@/shared/protocol/socket";
import { SOCKET_PROTOCOL_VERSION } from "@/shared/protocol/socket";
import type { PublishAcknowledgement } from "@/components/board/use-board-sync";

import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((module) => module.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-ink-muted">
        Loading canvas…
      </div>
    ),
  },
);

export type BoardCanvasProps = {
  sessionId: string;
  role: "teacher" | "student";
  /** When omitted, Phase 2 proof mode mints via /api/proof-socket-token */
  roomToken?: string;
  refreshRoomToken?: () => Promise<string>;
  /** Local snapshot callback used only when the teacher ends a session. */
  onSceneChange?: (scene: unknown, boardVersion: number) => void;
  /**
   * Phase 11: a prepared board the class opens on. Seeded into the canvas as
   * ordinary elements, so the teacher's first change publishes it down the
   * existing board path and every element stays editable.
   */
  initialScene?: unknown;
};

type SceneData = {
  elements: ExcalidrawElement[];
  appState?: Pick<AppState, "viewBackgroundColor">;
};

function sceneData(value: unknown): SceneData {
  if (!value || typeof value !== "object") return { elements: [] };
  const source = value as { elements?: unknown; appState?: unknown };
  return {
    elements: Array.isArray(source.elements)
      ? (source.elements as ExcalidrawElement[])
      : [],
    appState:
      source.appState &&
      typeof source.appState === "object" &&
      "viewBackgroundColor" in source.appState
        ? {
            viewBackgroundColor: String(
              (source.appState as { viewBackgroundColor?: unknown }).viewBackgroundColor,
            ),
          }
        : undefined,
  };
}

export function BoardCanvas({ sessionId, role, roomToken: roomTokenProp, refreshRoomToken, onSceneChange, initialScene }: BoardCanvasProps) {
  const isTeacher = role === "teacher";
  // Only the writer may open a class on a prepared board.
  const preparedElements = isTeacher ? sceneData(initialScene).elements : [];
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const mountedRef = useRef(false);
  const canvasInitFrameRef = useRef<number | null>(null);
  const viewportAnimationRef = useRef<{
    frame: number;
    resolve: () => void;
  } | null>(null);
  const applyingRemoteRef = useRef(false);
  const sceneElementsRef = useRef<readonly ExcalidrawElement[]>(preparedElements);
  const sceneFilesRef = useRef<BinaryFiles>({});
  const pendingRemoteSceneRef = useRef<{ scene: unknown; files?: BinaryFiles } | null>(null);
  const pendingRef = useRef<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  } | null>(null);
  const broadcastTimerRef = useRef<number | null>(null);
  const lastPublishedElementsRef = useRef<string>("[]");
  const publishInFlightRef = useRef(false);

  const publishViewportRef = useRef<
    ((viewport: { x: number; y: number; zoom: number; pageId?: string }) => void) | null
  >(null);
  const handleRemoteViewportRef = useRef<
    ((viewport: TeacherViewportCoords) => void) | null
  >(null);
  const disposeViewportRef = useRef<(() => void) | null>(null);
  const flushPendingRef = useRef<(() => void) | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const initialViewportSentRef = useRef(false);

  // Proof mode mints its own token; a supplied prop always wins by derivation.
  const [mintedToken, setMintedToken] = useState<string | undefined>(undefined);
  const [mintError, setMintError] = useState<string | null>(null);
  const roomToken = roomTokenProp ?? mintedToken;
  const tokenError = roomTokenProp ? null : mintError;
  const [studentViewport, setStudentViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [theme, setTheme] = useState<Theme>("light");
  const [sceneSeed, setSceneSeed] = useState<{
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles;
  }>({ elements: preparedElements, files: {} });
  const [blockHighlight, setBlockHighlight] = useState<BlockHighlight | null>(null);
  const [revealState, setRevealState] = useState<{ all: ExcalidrawElement[]; visible: number } | null>(null);

  useEffect(() => {
    const updateTheme = () => {
      setSceneSeed({ elements: sceneElementsRef.current, files: sceneFilesRef.current });
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    };
    updateTheme();
    window.addEventListener(THEME_CHANGE_EVENT, updateTheme);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, updateTheme);
  }, []);

  useEffect(() => {
    if (roomTokenProp) return;

    let cancelled = false;
    const params = new URLSearchParams({ sessionId, role });
    void (async () => {
      try {
        const response = await fetch(`/api/proof-socket-token?${params.toString()}`);
        const body = (await response.json()) as { token?: string; error?: string };
        if (cancelled) return;
        if (!response.ok || typeof body.token !== "string") {
          setMintError(body.error ?? "Could not mint proof socket token.");
          setMintedToken(undefined);
          return;
        }
        setMintedToken(body.token);
        setMintError(null);
      } catch {
        if (!cancelled) {
          setMintError("Could not mint proof socket token.");
          setMintedToken(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomTokenProp, role, sessionId]);

  const pushSceneToApi = useCallback((scene: unknown, files?: BinaryFiles) => {
    const api = apiRef.current;
    if (!api || !mountedRef.current) {
      pendingRemoteSceneRef.current = { scene, files };
      return;
    }
    const parsed = sceneData(scene);
    sceneElementsRef.current = parsed.elements;
    if (files) sceneFilesRef.current = files;
    lastPublishedElementsRef.current = JSON.stringify(parsed.elements);
    applyingRemoteRef.current = true;
    if (files) api.addFiles(Object.values(files));
    api.updateScene({ elements: parsed.elements, captureUpdate: "NEVER" });
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 0);
  }, []);

  const applyRemoteScene = useCallback(
    (scene: unknown, _boardVersion: number, files?: BinaryFiles) => {
      // Preserve an unsent teacher edit during reconnect/resync. The canonical
      // response may legitimately be older than the local scene.
      if (isTeacher && pendingRef.current) return;
      pushSceneToApi(scene, files);
    },
    [isTeacher, pushSceneToApi],
  );

  const applyTeacherViewportToApi = useCallback((viewport: TeacherViewportCoords) => {
    const api = apiRef.current;
    if (!api || !mountedRef.current) return Promise.resolve();

    if (viewportAnimationRef.current) {
      window.cancelAnimationFrame(viewportAnimationRef.current.frame);
      viewportAnimationRef.current.resolve();
      viewportAnimationRef.current = null;
    }

    const current = api.getAppState();
    const start = {
      x: current.scrollX,
      y: current.scrollY,
      zoom: current.zoom.value,
    };
    const target = {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom as NormalizedZoomValue,
    };
    const duration = 360;

    return new Promise<void>((resolve) => {
      const animation = { frame: 0, resolve };
      const startedAt = performance.now();
      const tick = (now: number) => {
        if (viewportAnimationRef.current !== animation || !mountedRef.current) {
          resolve();
          return;
        }
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        api.updateScene({
          appState: {
            scrollX: start.x + (target.x - start.x) * eased,
            scrollY: start.y + (target.y - start.y) * eased,
            zoom: {
              value: (start.zoom + (target.zoom - start.zoom) * eased) as NormalizedZoomValue,
            },
          },
          captureUpdate: "NEVER",
        });
        if (progress >= 1) {
          viewportAnimationRef.current = null;
          resolve();
          return;
        }
        animation.frame = window.requestAnimationFrame(tick);
      };
      viewportAnimationRef.current = animation;
      animation.frame = window.requestAnimationFrame(tick);
    });
  }, []);

  // Excalidraw can provide its imperative API before its internal React tree
  // has mounted. Updating it synchronously (or on a single zero-delay timer)
  // triggers React's "setState before mounted" warning. Wait for two paint
  // frames and verify both the parent and API are still mounted before use.
  const scheduleCanvasInitialization = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      if (canvasInitFrameRef.current !== null) {
        window.cancelAnimationFrame(canvasInitFrameRef.current);
      }

      const firstFrame = window.requestAnimationFrame(() => {
        canvasInitFrameRef.current = window.requestAnimationFrame(() => {
          canvasInitFrameRef.current = null;
          if (!mountedRef.current || apiRef.current !== api) return;

          api.updateScene({
            elements: api.getSceneElements(),
            appState: {
              theme,
              viewBackgroundColor: theme === "dark" ? "#1d1e1b" : "#ffffff",
            },
            captureUpdate: "NEVER",
          });
          const pending = pendingRemoteSceneRef.current;
          if (pending !== null) {
            pendingRemoteSceneRef.current = null;
            pushSceneToApi(pending.scene, pending.files);
          }
        });
      });
      canvasInitFrameRef.current = firstFrame;
    },
    [pushSceneToApi, theme],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (canvasInitFrameRef.current !== null) {
        window.cancelAnimationFrame(canvasInitFrameRef.current);
        canvasInitFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (api) scheduleCanvasInitialization(api);
  }, [scheduleCanvasInitialization, theme]);

  const onExcalidrawApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      setCanvasReady(true);
      scheduleCanvasInitialization(api);
    },
    [scheduleCanvasInitialization],
  );

  const viewport = useTeacherViewport({
    role,
    onEmitViewport: (coords) => {
      publishViewportRef.current?.({
        x: coords.x,
        y: coords.y,
        zoom: coords.zoom,
        pageId: coords.pageId,
      });
    },
    applyViewport: applyTeacherViewportToApi,
  });

  const {
    status,
    latestVersion,
    publishScene,
    publishViewport,
    publishBlockHighlight,
    reconnect,
    error: syncError,
  } = useBoardSync({
    sessionId,
    role,
    roomToken,
    refreshRoomToken,
    onRemoteScene: applyRemoteScene,
    onTeacherViewport: (packet) => {
      handleRemoteViewportRef.current?.({
        x: packet.x,
        y: packet.y,
        zoom: packet.zoom,
        ts: packet.ts,
        pageId: packet.pageId,
      });
    },
    onBlockHighlight: setBlockHighlight,
  });

  // Latest-callback refs are written after render, never during it.
  useEffect(() => {
    handleRemoteViewportRef.current = viewport.handleRemoteViewport;
    publishViewportRef.current = publishViewport;
    disposeViewportRef.current = viewport.dispose;
  });

  const onTeacherCameraChange = viewport.onTeacherCameraChange;

  // A student may join after the teacher has stopped moving. Publish the
  // current camera once per connected teacher session so Follow Teacher has a
  // real target immediately, instead of waiting for the next scroll event.
  // This runs after the latest-callback refs above, so the first frame cannot
  // be consumed before the socket publisher is installed.
  useEffect(() => {
    if (!isTeacher || status !== "connected") {
      initialViewportSentRef.current = false;
      return;
    }
    if (initialViewportSentRef.current || !canvasReady) return;
    const api = apiRef.current;
    if (!api) return;
    const appState = api.getAppState();
    initialViewportSentRef.current = true;
    onTeacherCameraChange(appState.scrollX, appState.scrollY, appState.zoom.value);
  }, [canvasReady, isTeacher, onTeacherCameraChange, status]);

  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || !isTeacher || publishInFlightRef.current) return;
    const fingerprint = JSON.stringify(pending.elements);
    if (fingerprint === lastPublishedElementsRef.current) {
      pendingRef.current = null;
      return;
    }
    publishInFlightRef.current = true;
    const published = publishScene({
      elements: pending.elements,
      appState: { viewBackgroundColor: pending.appState.viewBackgroundColor },
    }, pending.files, ((result) => {
      publishInFlightRef.current = false;
      if (result.ok) {
        pendingRef.current = null;
        lastPublishedElementsRef.current = fingerprint;
      }
      // Drain via the latest-callback ref: this acknowledgement fires after the
      // render that created it, so the closed-over binding may be stale.
      if (pendingRef.current) flushPendingRef.current?.();
    }) as PublishAcknowledgement);
    if (published) {
      return;
    }
    publishInFlightRef.current = false;
  }, [isTeacher, publishScene]);

  useEffect(() => {
    flushPendingRef.current = flushPending;
  });

  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      if (!isTeacher || applyingRemoteRef.current) return;
      // Ignore Excalidraw mount/appState churn until the element set actually changes.
      const fingerprint = JSON.stringify(elements);
      if (fingerprint === lastPublishedElementsRef.current) return;
      pendingRef.current = { elements, appState, files };
      sceneElementsRef.current = elements;
      sceneFilesRef.current = files;
      onSceneChange?.({ elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files }, latestVersion + 1);
      if (broadcastTimerRef.current === null) {
        flushPending();
        broadcastTimerRef.current = window.setTimeout(() => {
          broadcastTimerRef.current = null;
          flushPending();
        }, BOARD_UPDATE_MIN_MS);
      }
    },
    [flushPending, isTeacher, latestVersion, onSceneChange],
  );

  useEffect(() => {
    return () => {
      if (broadcastTimerRef.current !== null) {
        window.clearTimeout(broadcastTimerRef.current);
        broadcastTimerRef.current = null;
      }
      if (canvasInitFrameRef.current !== null) {
        window.cancelAnimationFrame(canvasInitFrameRef.current);
        canvasInitFrameRef.current = null;
      }
      disposeViewportRef.current?.();
      if (viewportAnimationRef.current) {
        window.cancelAnimationFrame(viewportAnimationRef.current.frame);
        viewportAnimationRef.current.resolve();
        viewportAnimationRef.current = null;
      }
    };
  }, []);

  const onScrollChange = useCallback(
    (x: number, y: number, zoom: AppState["zoom"]) => {
      if (isTeacher) {
        viewport.onTeacherCameraChange(x, y, zoom.value);
        return;
      }

      // Local camera only — never emit student viewport on the socket.
      setStudentViewport({ x, y, zoom: zoom.value });
      viewport.onLocalPanZoom();
    },
    [isTeacher, viewport],
  );

  const displayError = tokenError ?? syncError;

  const insertBlock = useCallback((compiled: BlockCompileResult) => {
    if (!isTeacher || !apiRef.current) return;
    void import("@excalidraw/excalidraw").then(({ convertToExcalidrawElements }) => {
      const api = apiRef.current;
      if (!api) return;
      const existing = api.getSceneElements();
      const offset = existing.length ? 40 + (existing.length % 5) * 24 : 0;
      const skeletons = compiled.elements.map((element) => ({ ...element, x: (element.x ?? 0) + offset, y: (element.y ?? 0) + offset })) as Parameters<typeof convertToExcalidrawElements>[0];
      const next = convertToExcalidrawElements(skeletons, { regenerateIds: true });
      api.addFiles(Object.values(compiled.files));
      const visible = compiled.options.reveal === "step"
        ? Math.min(next.length, Math.max(1, Math.ceil(next.length / 4)))
        : next.length;
      setRevealState(compiled.options.reveal === "step" && visible < next.length ? { all: next, visible } : null);
      api.updateScene({
        elements: [...existing, ...next.slice(0, visible)],
        captureUpdate: "IMMEDIATELY",
      });
    });
  }, [isTeacher]);

  const revealNext = useCallback(() => {
    const api = apiRef.current;
    if (!api || !revealState) return;
    const nextVisible = Math.min(revealState.all.length, revealState.visible + Math.max(1, Math.ceil(revealState.all.length / 4)));
    const hiddenIds = new Set(revealState.all.map((element) => element.id));
    const existing = api.getSceneElements().filter((element) => !hiddenIds.has(element.id));
    api.updateScene({
      elements: [...existing, ...revealState.all.slice(0, nextVisible)],
      captureUpdate: "IMMEDIATELY",
    });
    setRevealState(nextVisible < revealState.all.length ? { all: revealState.all, visible: nextVisible } : null);
  }, [revealState]);

  const broadcastHighlight = useCallback((highlight: Pick<BlockHighlight, "blockId" | "startLine" | "endLine">) => {
    const local = { v: SOCKET_PROTOCOL_VERSION, sessionId, ts: Date.now(), ...highlight } as BlockHighlight;
    setBlockHighlight(local);
    publishBlockHighlight(highlight);
  }, [publishBlockHighlight, sessionId]);

  useEffect(() => {
    if (!blockHighlight) return;
    const timeout = window.setTimeout(() => setBlockHighlight(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [blockHighlight]);

  // Fullscreen targets the board frame, so Excalidraw keeps its own sizing and
  // the room chrome outside the frame simply stops being painted.
  useEffect(() => {
    const onChangeFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
    };
    document.addEventListener("fullscreenchange", onChangeFullscreen);
    return () => document.removeEventListener("fullscreenchange", onChangeFullscreen);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const node = frameRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void node.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!isTeacher ? (
        <div className="shrink-0">
          <FollowControls
            followEnabled={viewport.followEnabled}
            hasTeacherViewport={viewport.lastTeacherViewport !== null}
            onFollowTeacher={viewport.followTeacher}
            onFreeRoam={() => viewport.setFollowEnabled(false)}
          />
        </div>
      ) : null}
      <div
        ref={frameRef}
        className="syncvas-board-frame min-h-0 flex-1 [&_.excalidraw]:h-full [&_.excalidraw]:min-h-[24rem]"
        data-board-theme={theme}
      >
        <Excalidraw
          key={theme}
          excalidrawAPI={onExcalidrawApi}
          onChange={isTeacher ? onChange : undefined}
          onScrollChange={onScrollChange}
          initialData={{
            elements: sceneSeed.elements,
            files: sceneSeed.files,
            appState: {
              theme,
              viewBackgroundColor: theme === "dark" ? "#1d1e1b" : "#fffefa",
            },
          }}
          theme={theme}
          viewModeEnabled={!isTeacher}
          UIOptions={
            isTeacher
              ? { tools: { image: false } }
              : {
                  canvasActions: {
                    clearCanvas: false,
                    export: false,
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                    changeViewBackgroundColor: false,
                  },
                  tools: { image: false },
                }
          }
          zenModeEnabled={false}
          autoFocus={isTeacher}
        />
        <div className="syncvas-board-theme-scrim" aria-hidden="true" />
        {/* Excalidraw owns the top-left menu, top-centre tool rail, top-right
            library, and both bottom corners. Keep Syncvas status below that
            native control band so our chrome never hides a drawing action. */}
        {/* Hidden below `sm`: Excalidraw's mobile toolbar owns the top of the
            frame, and the room dock already carries live/room state there. */}
        <div
          className={
            isTeacher
              ? "syncvas-board-chrome syncvas-teacher-board-strip absolute left-3 right-3 top-[4.5rem] z-10 hidden items-center justify-between gap-3 sm:left-4 sm:right-4 sm:flex"
              : "syncvas-board-chrome absolute left-3 top-[4.5rem] z-10 hidden max-w-[min(19rem,calc(100%-2rem))] flex-col items-start gap-2 sm:left-4 sm:flex"
          }
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="syncvas-pill">
              {isTeacher ? "Teacher canvas" : "Read-only view"} · v{latestVersion}
            </span>
            {isTeacher ? (
              <span
                className={
                  status === "connected"
                    ? "syncvas-pill syncvas-pill-accent"
                    : status === "offline"
                      ? "syncvas-pill syncvas-pill-danger"
                      : "syncvas-pill syncvas-pill-warning"
                }
              >
                {status === "connected" ? <span className="syncvas-live-dot" aria-hidden="true" /> : null}
                {boardSyncStatusLabel(status)}
              </span>
            ) : null}
            <button
              type="button"
              className="syncvas-icon-btn"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen board" : "Show board fullscreen"}
              data-tooltip={isFullscreen ? "Exit fullscreen" : "Fullscreen board"}
            >
              {isFullscreen ? <ExitFullscreenGlyph /> : <FullscreenGlyph />}
            </button>
            {isTeacher ? <BlockPanel onInsert={insertBlock} onHighlight={broadcastHighlight} boardTheme={theme} /> : null}
            {isTeacher && revealState ? (
              <button
                type="button"
                className="syncvas-icon-btn"
                onClick={revealNext}
                aria-label="Reveal next block step"
                data-tooltip={`Reveal next step (${revealState.visible}/${revealState.all.length})`}
              >
                <span aria-hidden="true">»</span>
              </button>
            ) : null}
          </div>

          <div className="pointer-events-none flex flex-wrap gap-2">
            <span
              className={
                !isTeacher && status === "connected"
                  ? "syncvas-pill"
                  : !isTeacher && status === "offline"
                    ? "syncvas-pill syncvas-pill-danger"
                    : !isTeacher
                      ? "syncvas-pill syncvas-pill-warning"
                      : "hidden"
              }
            >
              {!isTeacher && status === "connected" ? <span className="syncvas-live-dot" aria-hidden="true" /> : null}
              {boardSyncStatusLabel(status)}
            </span>
            {!isTeacher ? (
              <span className="syncvas-pill">
                {viewport.followEnabled ? "Following" : "Free roam"} ·{" "}
                {Math.round(studentViewport.zoom * 100)}%
              </span>
            ) : null}
          </div>
          {status === "offline" ? (
            <div className="pointer-events-auto w-full max-w-[min(22rem,calc(100vw-2rem))]">
              <ReconnectBanner onRetry={reconnect} />
            </div>
          ) : null}
        </div>
        {displayError ? (
          <div
            className="syncvas-board-alert absolute right-3 bottom-14 z-10 flex max-w-[min(23rem,calc(100%-1.5rem))] items-start gap-2 px-3 py-2 sm:right-4 sm:bottom-16"
            role="alert"
            data-tooltip={displayError}
          >
            <AlertGlyph />
            <span className="min-w-0 truncate">{displayError}</span>
          </div>
        ) : null}
        {blockHighlight ? (
          <div className="syncvas-board-highlight absolute right-3 top-[4.5rem] z-10 max-w-[min(17rem,calc(100%-1.5rem))] px-3 py-2 sm:right-4" role="status">
            <span className="syncvas-highlight-dot" aria-hidden="true" />
            Line {blockHighlight.startLine}{blockHighlight.endLine ? `–${blockHighlight.endLine}` : ""} pointed out
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AlertGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m10 3 7 13H3L10 3Z" />
      <path d="M10 7.5v4M10 14.2v.1" />
    </svg>
  );
}

function FullscreenGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 3.5H3.5V7.5M12.5 3.5h4v4M12.5 16.5h4v-4M7.5 16.5h-4v-4" />
    </svg>
  );
}

function ExitFullscreenGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.5h4v-4M16.5 7.5h-4v-4M16.5 12.5h-4v4M3.5 12.5h4v4" />
    </svg>
  );
}
