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

import Link from "next/link";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { JoinQrButton } from "@/components/room/join-qr";
import { ParticipantCount } from "@/components/room/participant-count";
import { ExportActions } from "@/components/export/export-actions";
import { ExportStatus } from "@/components/export/export-status";
import { TeacherNotesPanel } from "@/components/summary/teacher-notes-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useStoredValue } from "@/lib/client-store";
import {
  LOCAL_TEACHER_STORAGE_KEY,
  ACTIVE_TEACHER_SESSION_STORAGE_KEY,
  clearActiveTeacherSession,
  parseActiveTeacherSession,
  parseLocalTeacherBootstrap,
  roomTokenStorageKey,
  writeActiveTeacherSession,
  writeLocalTeacherBootstrap,
  type LocalTeacherBootstrap,
} from "@/lib/local-teacher";
import { extractErrorCode, toUserFacingError } from "@/lib/user-facing-errors";
import type { SessionStatus } from "@/shared/types/session";
import { LOCAL_TEACHER_ENABLED, canRunTeacherQuery, useTeacherAccess } from "@/lib/teacher-access";
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
  status: SessionStatus;
};

export type TeacherSessionControlsProps = {
  onLiveSession?: (
    session: TeacherSessionState,
    roomToken: string,
    refreshRoomToken: () => Promise<string>,
  ) => void;
  onSessionEnded?: () => void;
  /**
   * Saves the final board and begins ending in one transactional call. The old
   * shape saved and ended separately, which could end a room with no board.
   */
  onEndSession?: (session: TeacherSessionState) => Promise<{ status: "ending" | "ended" }>;
};

const localTeacherEnabled = LOCAL_TEACHER_ENABLED;

function readableError(error: unknown): string {
  // Match the stable code, not the message text: a production Convex deployment
  // delivers the code in ConvexError.data and strips prose from anything else.
  const code = extractErrorCode(error);
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (code === "DEV_TEACHER_DISABLED") {
    return "Local teacher mode is off. Set ALLOW_DEV_TEACHER=1 on the Convex deployment.";
  }
  if (code === "UNAUTHENTICATED" || message.includes("Sign in")) {
    return "Sign in as a teacher to manage this classroom.";
  }
  if (code === "SESSION_NOT_STARTABLE") return "This room cannot be started.";
  if (code === "SESSION_NOT_ENDABLE") return "Only a live room can be ended.";
  return toUserFacingError(error, "We could not complete that room action. Try again.").message;
}

export function TeacherSessionControls({
  onLiveSession,
  onSessionEnded,
  onEndSession,
}: TeacherSessionControlsProps) {
  const ensureLocalTeacher = useMutation(api.authBootstrap.ensureLocalTeacher);
  const createTeacher = useMutation(api.sessions.create);
  const startTeacher = useMutation(api.sessions.start);
  const endTeacher = useMutation(api.sessions.end);
  const issueToken = useAction(api.sessions.issueSocketToken);

  // localStorage is an external system: subscribed, not copied into state.
  const bootstrap = useStoredValue<LocalTeacherBootstrap | null>({
    storage: "local",
    key: LOCAL_TEACHER_STORAGE_KEY,
    parse: parseLocalTeacherBootstrap,
    serverValue: null,
  });
  const [title, setTitle] = useState("");
  const storedSession = useStoredValue<TeacherSessionState | null>({
    storage: "local",
    key: ACTIVE_TEACHER_SESSION_STORAGE_KEY,
    parse: parseActiveTeacherSession,
    serverValue: null,
  });
  const session = storedSession;
  /** Kept after localStorage clear so End Class wrap-up CTAs remain visible. */
  const [endedWrapUp, setEndedWrapUp] = useState<TeacherSessionState | null>(null);
  const [endPhase, setEndPhase] = useState<"idle" | "saving" | "ending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restoredSessionRef = useRef<string | null>(null);
  const access = useTeacherAccess();
  const mayQuery = canRunTeacherQuery(access);
  const observedSession = useQuery(
    api.sessions.getTeacherSession,
    // A stale room in localStorage must not run an ownership query the caller
    // cannot pass; that error would rethrow out of render.
    session && mayQuery ? { sessionId: session.sessionId as Id<"sessions"> } : "skip",
  );
  const effectiveSession = session && observedSession ? { ...session, status: observedSession.status } : session;

  const mintAndPublish = useCallback(
    async (next: TeacherSessionState) => {
      if (next.status !== "live") return;
      restoredSessionRef.current = next.sessionId;
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

  // Browser storage is only a restore hint. Convex revalidates ownership and
  // current status before a fresh token is issued.
  useEffect(() => {
    if (!session || session.status !== "live" || observedSession?.status !== "live") return;
    if (restoredSessionRef.current === session.sessionId) return;
    void mintAndPublish({ ...session, status: "live" }).catch((restoreError: unknown) => {
      restoredSessionRef.current = null;
      setError(readableError(restoreError));
      clearActiveTeacherSession();
    });
  }, [mintAndPublish, observedSession?.status, session]);

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
      const result = await createTeacher({ title: title.trim() || undefined });
      writeActiveTeacherSession({
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
        const result = await startTeacher({ sessionId: session.sessionId as Id<"sessions"> });
        const next: TeacherSessionState = {
          sessionId: result.sessionId,
          joinCode: result.joinCode,
          status: result.status,
        };
        writeActiveTeacherSession(next);
        await mintAndPublish(next);
      } else {
        setEndPhase("saving");
        // One call saves the board and starts finalization. Falling back to the
        // plain end mutation only when no save handler is wired keeps the
        // component usable on surfaces that have no canvas to capture.
        const result = onEndSession
          ? await onEndSession(session)
          : await endTeacher({ sessionId: session.sessionId as Id<"sessions"> });
        setEndPhase("ending");
        if (result.status === "ended") {
          setEndedWrapUp({ ...session, status: "ended" });
          setEndPhase("done");
          clearActiveTeacherSession();
        } else {
          writeActiveTeacherSession({ ...session, status: result.status });
          setEndPhase("idle");
        }
        window.sessionStorage.removeItem(roomTokenStorageKey(session.sessionId));
        onSessionEnded?.();
      }
    } catch (transitionError) {
      setEndPhase("idle");
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
        statusLabel={endPhase === "saving" ? "Saving board…" : endPhase === "ending" ? "Ending…" : statusLabel}
        busy={busy}
        errorNode={errorNode}
        onEndRoom={() => void transition("end")}
      />
    );
  }

  if (endedWrapUp) {
    return (
      <section
        aria-labelledby="teacher-ended-title"
        className="order-first shrink-0 px-4 py-5 sm:px-6 sm:py-6"
      >
        <div className="mx-auto w-full max-w-3xl">
          <div className="syncvas-panel overflow-hidden">
            <header className="px-5 pt-5 pb-4 sm:px-6">
              <p className="syncvas-eyebrow">Class ended</p>
              <h2 id="teacher-ended-title" className="mt-2 text-2xl font-semibold tracking-[-0.045em]">
                Board saved
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
                Room <span className="font-mono font-semibold text-ink">{endedWrapUp.joinCode}</span> is
                closed. Export the board, check AI notes when ready, or open History anytime. AI notes
                never undo End Class.
              </p>
            </header>
            <div className="syncvas-color-field h-[3px] w-full" aria-hidden="true" />
            <div className="grid gap-4 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <ExportActions sessionId={endedWrapUp.sessionId} />
                <Link href="/teacher/history" className="syncvas-btn syncvas-btn-secondary">
                  History
                </Link>
                <Link href="/teacher/dashboard" className="syncvas-btn syncvas-btn-ghost">
                  Dashboard
                </Link>
                <button
                  type="button"
                  className="syncvas-btn syncvas-btn-primary ml-auto"
                  onClick={() => {
                    setEndedWrapUp(null);
                    setEndPhase("idle");
                    setTitle("");
                  }}
                >
                  New class
                </button>
              </div>
              <ExportStatus sessionId={endedWrapUp.sessionId} />
              <TeacherNotesPanel sessionId={endedWrapUp.sessionId} />
              {errorNode}
            </div>
          </div>
        </div>
      </section>
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
            <div className="flex shrink-0 items-center gap-2">
              {localTeacherEnabled && bootstrap ? (
                <span className="syncvas-pill max-w-full" title={bootstrap.authSubject}>
                  <span className="syncvas-live-dot" aria-hidden="true" />
                  <span className="truncate">Local teacher</span>
                </span>
              ) : null}
              <ThemeToggle />
            </div>
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
            ) : access === "resolving" ? (
              <div className="syncvas-sunken p-4" aria-busy="true">
                <p className="text-sm leading-6 text-ink-muted">Checking your teacher account…</p>
              </div>
            ) : access === "signed-out" ? (
              <div className="syncvas-sunken p-4">
                <p className="text-sm leading-6 text-ink-muted">
                  Sign in with your teacher account to create a classroom. Authentication is
                  provided by the deployment; this page never accepts a teacher ID from the browser.
                </p>
                <Link href="/teacher/sign-in" className="syncvas-btn syncvas-btn-primary mt-4 inline-flex">
                  Teacher sign in
                </Link>
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
  const [confirmingEnd, setConfirmingEnd] = useState(false);
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
    <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex justify-end sm:bottom-4 sm:right-4">
      <div className="pointer-events-auto flex w-full max-w-[min(34rem,calc(100vw-1.5rem))] flex-col items-end gap-2">
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
                <button type="button" className="syncvas-icon-btn" onClick={collapse} aria-label="Collapse room controls" data-tooltip="Collapse room controls" title="Collapse room controls">
                  <ChevronGlyph up />
                </button>
              </div>
            </div>

            <hr className="syncvas-divider" />

            <div className="flex flex-wrap items-center gap-2">
              <JoinQrButton joinCode={session.joinCode} />
              <ExportActions sessionId={session.sessionId} />
              {confirmingEnd ? (
                <div className="ml-auto flex w-full flex-wrap items-center justify-between gap-3 rounded-control border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-danger-soft px-3 py-2 sm:w-auto">
                  <p className="text-xs leading-5 text-danger">
                    End this room? The final board will be saved and new joins will stop.
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm"
                      disabled={busy || status === "ending"}
                      onClick={() => setConfirmingEnd(false)}
                    >
                      Keep teaching
                    </button>
                    <button
                      type="button"
                      className="syncvas-btn syncvas-btn-danger syncvas-btn-sm"
                      disabled={busy || status === "ending"}
                      onClick={() => {
                        setConfirmingEnd(false);
                        onEndRoom();
                      }}
                    >
                      {status === "ending" ? "Ending…" : "End room"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy || status === "ending"}
                  onClick={() => setConfirmingEnd(true)}
                  className="syncvas-btn syncvas-btn-danger-quiet ml-auto"
                >
                  {status === "ending" ? "Ending…" : "End room"}
                </button>
              )}
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
            data-tooltip="Open room controls"
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
