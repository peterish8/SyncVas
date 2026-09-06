/**
 * Teacher room lifecycle chrome.
 *
 * Two presentations of one state machine:
 *  - before the room is live, a single composed setup surface;
 *  - once live, a floating dock over the board that expands back to the full
 *    control set (code, participants, QR, export, end room) on demand.
 *
 * Production uses authenticated Convex mutations. The local-dev mutation
 * family is available only behind an explicit development build flag.
 */

"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { JoinQrButton } from "@/components/room/join-qr";
import { ParticipantCount } from "@/components/room/participant-count";
import { ExportActions } from "@/components/export/export-actions";
import { ExportStatus } from "@/components/export/export-status";
import { useStoredValue } from "@/lib/client-store";
import {
  LOCAL_TEACHER_STORAGE_KEY,
  parseLocalTeacherBootstrap,
  roomTokenStorageKey,
  writeLocalTeacherBootstrap,
  type LocalTeacherBootstrap,
} from "@/lib/local-teacher";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type TeacherSessionState = {
  sessionId: string;
  joinCode: string;
  status: "draft" | "live" | "ending" | "ended";
};

export type TeacherSessionControlsProps = {
  onLiveSession?: (
    session: TeacherSessionState,
    roomToken: string,
    refreshRoomToken: () => Promise<string>,
  ) => void;
  onSessionEnded?: () => void;
  onBeforeEnd?: (session: TeacherSessionState) => Promise<void>;
};

const localTeacherEnabled =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_LOCAL_TEACHER === "1";

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("DEV_TEACHER_DISABLED")) {
    return "Local teacher mode is off. Set ALLOW_DEV_TEACHER=1 on the Convex deployment.";
  }
  if (message.includes("UNAUTHENTICATED") || message.includes("Sign in")) {
    return "Sign in as a teacher to manage this classroom.";
  }
  if (message.includes("SESSION_NOT_STARTABLE")) return "This room cannot be started.";
  if (message.includes("SESSION_NOT_ENDABLE")) return "Only a live room can be ended.";
  if (message.includes("SESSION_NOT_LIVE") || message.includes("SESSION_ENDED")) {
    return "The room is not live. Start it before opening the board.";
  }
  if (message.includes("SCENE_TOO_LARGE")) return "The board is too large to save. Export it before ending the room.";
  if (message.includes("FINAL_SNAPSHOT_MISSING")) return "We could not save the final board. Keep the room open and try again.";
  return "We could not complete that room action. Try again.";
}

export function TeacherSessionControls({
  onLiveSession,
  onSessionEnded,
  onBeforeEnd,
}: TeacherSessionControlsProps) {
  const ensureLocalTeacher = useMutation(api.authBootstrap.ensureLocalTeacher);
  const createTeacher = useMutation(api.sessions.create);
  const startTeacher = useMutation(api.sessions.start);
  const endTeacher = useMutation(api.sessions.end);
  const createLocal = useMutation(api.sessions.createAsLocalTeacher);
  const startLocal = useMutation(api.sessions.startAsLocalTeacher);
  const endLocal = useMutation(api.sessions.endAsLocalTeacher);
  const issueToken = useAction(api.sessions.issueSocketToken);

  // localStorage is an external system: subscribed, not copied into state.
  const bootstrap = useStoredValue<LocalTeacherBootstrap | null>({
    storage: "local",
    key: LOCAL_TEACHER_STORAGE_KEY,
    parse: parseLocalTeacherBootstrap,
    serverValue: null,
  });
  const [title, setTitle] = useState("");
  const [session, setSession] = useState<TeacherSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const observedSession = useQuery(
    localTeacherEnabled ? api.sessions.getLocalTeacherSession : api.sessions.getTeacherSession,
    session ? { sessionId: session.sessionId as Id<"sessions"> } : "skip",
  );
  const effectiveSession = session && observedSession ? { ...session, status: observedSession.status } : session;

  const mintAndPublish = useCallback(
    async (next: TeacherSessionState) => {
      if (next.status !== "live") return;
      const issueArgs = localTeacherEnabled
        ? { sessionId: next.sessionId as Id<"sessions">, asLocalTeacher: true as const }
        : { sessionId: next.sessionId as Id<"sessions"> };
      const requestFreshToken = async () => (await issueToken(issueArgs)).token;
      const token = await requestFreshToken();
      window.sessionStorage.setItem(roomTokenStorageKey(next.sessionId), token);
      onLiveSession?.(next, token, requestFreshToken);
    },
    [issueToken, onLiveSession],
  );

  async function onContinueAsLocalTeacher() {
    setBusy(true);
    setError(null);
    try {
      const result = await ensureLocalTeacher({});
      writeLocalTeacherBootstrap(result);
    } catch (bootstrapError) {
      setError(readableError(bootstrapError));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (localTeacherEnabled && !bootstrap) {
      setError("Continue as local teacher before creating a room.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = localTeacherEnabled
        ? await createLocal({ title: title.trim() || undefined })
        : await createTeacher({ title: title.trim() || undefined });
      setSession({
        sessionId: result.sessionId,
        joinCode: result.joinCode,
        status: result.status,
      });
    } catch (createError) {
      setError(readableError(createError));
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "start" | "end") {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "start") {
        const result = localTeacherEnabled
          ? await startLocal({ sessionId: session.sessionId as Id<"sessions"> })
          : await startTeacher({ sessionId: session.sessionId as Id<"sessions"> });
        const next: TeacherSessionState = {
          sessionId: result.sessionId,
          joinCode: result.joinCode,
          status: result.status,
        };
        setSession(next);
        await mintAndPublish(next);
      } else {
        await onBeforeEnd?.(session);
        const result = localTeacherEnabled
          ? await endLocal({ sessionId: session.sessionId as Id<"sessions"> })
          : await endTeacher({ sessionId: session.sessionId as Id<"sessions"> });
        setSession((current) =>
          current
            ? {
                ...current,
                status: result.status,
              }
            : current,
        );
        window.sessionStorage.removeItem(roomTokenStorageKey(session.sessionId));
        onSessionEnded?.();
      }
    } catch (transitionError) {
      setError(readableError(transitionError));
    } finally {
      setBusy(false);
    }
  }

  const status = effectiveSession?.status ?? null;
  const statusLabel =
    status === "live"
      ? "Live"
      : status === "draft"
        ? "Draft"
        : status === "ending"
          ? "Ending"
          : status === "ended"
            ? "Ended"
            : null;

  const errorNode = error ? (
    <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
      {error}
    </p>
  ) : null;

  // Once the room is live the board is the product: the setup surface collapses
  // into a dock that expands back to the full controls on demand.
  if (session && (status === "live" || status === "ending")) {
    return (
      <RoomDock
        session={session}
        status={status}
        statusLabel={statusLabel}
        busy={busy}
        errorNode={errorNode}
        onEndRoom={() => void transition("end")}
      />
    );
  }

  return (
    <section
      aria-labelledby="teacher-room-title"
      className="order-first shrink-0 px-4 py-5 sm:px-6 sm:py-6"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="syncvas-panel overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
            <div className="min-w-0">
              <p className="syncvas-eyebrow">Teacher</p>
              <h2 id="teacher-room-title" className="mt-2 text-2xl font-semibold tracking-[-0.045em]">
                Open a classroom
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
                Create a room, start it, then share the code or QR. Students join without an
                account.
              </p>
            </div>
            {localTeacherEnabled && bootstrap ? (
              <span className="syncvas-pill max-w-full" title={bootstrap.authSubject}>
                <span className="syncvas-live-dot" aria-hidden="true" />
                <span className="truncate">Local teacher</span>
              </span>
            ) : null}
          </header>

          <div className="syncvas-color-field h-[3px] w-full" aria-hidden="true" />

          <div className="grid gap-5 px-5 py-5 sm:px-6">
            {localTeacherEnabled && !bootstrap ? (
              <div className="syncvas-sunken p-4">
                <p className="text-sm leading-6 text-ink-muted">
                  Local teacher mode is explicitly enabled for this development build.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onContinueAsLocalTeacher()}
                  className="syncvas-btn syncvas-btn-primary mt-4"
                >
                  Continue as local teacher
                </button>
              </div>
            ) : !localTeacherEnabled ? (
              <div className="syncvas-sunken p-4">
                <p className="text-sm leading-6 text-ink-muted">
                  Sign in with your teacher account to create a classroom. Authentication is
                  provided by the deployment; this page never accepts a teacher ID from the browser.
                </p>
              </div>
            ) : (
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={onCreate}>
                <div className="grid gap-2">
                  <label className="syncvas-label" htmlFor="room-title">
                    Room title <span className="font-normal text-ink-muted">(optional)</span>
                  </label>
                  <input
                    id="room-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Class 09 · Quadratics"
                    className="syncvas-control"
                    maxLength={120}
                    disabled={busy || Boolean(effectiveSession && status !== "ended")}
                  />
                </div>
                <button
                  className="syncvas-btn syncvas-btn-primary sm:min-w-[10rem]"
                  disabled={busy || Boolean(effectiveSession && status !== "ended")}
                  type="submit"
                >
                  Create room
                </button>
              </form>
            )}

            {session ? (
              <div className="syncvas-sunken grid gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="syncvas-eyebrow">Room code</p>
                    <p className="syncvas-code mt-2 text-3xl">{session.joinCode}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusLabel ? (
                      <span className={status === "live" ? "syncvas-pill syncvas-pill-accent" : "syncvas-pill"}>
                        {status === "live" ? <span className="syncvas-live-dot" aria-hidden="true" /> : null}
                        {statusLabel}
                      </span>
                    ) : null}
                    {status === "live" || status === "ending" ? (
                      <ParticipantCount sessionId={session.sessionId} />
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {status === "draft" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void transition("start")}
                      className="syncvas-btn syncvas-btn-success"
                    >
                      Start room
                    </button>
                  ) : null}
                  {status === "ended" ? (
                    <>
                      <ExportActions sessionId={session.sessionId} />
                      <ExportStatus sessionId={session.sessionId} />
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {errorNode}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Live-room chrome. The board owns the viewport; this is the only teacher
 * furniture on top of it.
 */
function RoomDock({
  session,
  status,
  statusLabel,
  busy,
  errorNode,
  onEndRoom,
}: {
  session: TeacherSessionState;
  status: "live" | "ending";
  statusLabel: string | null;
  busy: boolean;
  errorNode: ReactNode;
  onEndRoom: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  function collapse() {
    setExpanded(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center gap-2">
        {expanded ? (
          <div id={panelId} className="syncvas-panel syncvas-room-panel grid w-full gap-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="syncvas-eyebrow">Live room</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="syncvas-code text-2xl">{session.joinCode}</p>
                  {statusLabel ? (
                    <span className="syncvas-pill syncvas-pill-accent">
                      <span className="syncvas-live-dot" aria-hidden="true" />
                      {statusLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ParticipantCount sessionId={session.sessionId} />
                <button type="button" className="syncvas-icon-btn" onClick={collapse} aria-label="Collapse room controls" title="Collapse room controls">
                  <ChevronGlyph up />
                </button>
              </div>
            </div>

            <hr className="syncvas-divider" />

            <div className="flex flex-wrap items-center gap-2">
              <JoinQrButton joinCode={session.joinCode} />
              <ExportActions sessionId={session.sessionId} />
              <button
                type="button"
                disabled={busy || status === "ending"}
                onClick={onEndRoom}
                className="syncvas-btn syncvas-btn-danger-quiet ml-auto"
              >
                {status === "ending" ? "Ending…" : "End room"}
              </button>
            </div>
            <ExportStatus sessionId={session.sessionId} />
            {errorNode ? <div>{errorNode}</div> : null}
          </div>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className="syncvas-dock-collapsed"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label="Open room controls"
            title="Open room controls"
            onClick={() => setExpanded((value) => !value)}
          >
            <span className="syncvas-live-dot" aria-hidden="true" />
            <RoomGlyph />
          </button>
        )}
      </div>
    </div>
  );
}

function RoomGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="14" height="12" rx="3" />
      <path d="M6.5 8h7M6.5 11h4" />
    </svg>
  );
}

function ChevronGlyph({ up }: { up: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: up ? "rotate(180deg)" : undefined,
        transition: "transform var(--duration-hover) var(--ease-out)",
      }}
    >
      <path d="m5.5 12.5 4.5-4.5 4.5 4.5" />
    </svg>
  );
}
