/**
 * Teacher doubt queue — the "teacher can mark answered" acceptance path.
 *
 * docs/05 specifies a right-side sheet rather than a permanent sidebar: the
 * canvas dominates, and the queue is something the teacher glances at. The
 * sheet is deliberately non-modal — a teacher mid-stroke must not be trapped in
 * a dialog — so Escape and the close control return to the board without a
 * focus trap.
 *
 * Identity never appears here: the queue projection carries text and counts
 * only (docs/13).
 */

"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canRunTeacherQuery, teacherQueryArgs, useTeacherAccess } from "@/lib/teacher-access";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

type ResolveAction = "answered" | "dismissed";

export function TeacherDoubtQueue({ sessionId }: { sessionId: string }) {
  const access = useTeacherAccess();
  const queue = useQuery(
    api.doubts.listTeacherQueue,
    teacherQueryArgs(access, { sessionId: sessionId as Id<"sessions"> }),
  );
  const resolve = useMutation(
    api.doubts.resolve,
  );

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const onResolve = async (doubtId: string, action: ResolveAction) => {
    setBusy(doubtId);
    setError(null);
    try {
      await resolve({ doubtId: doubtId as Id<"doubts">, action });
      // The queue is a live Convex subscription, so the row leaves on its own;
      // no optimistic removal to roll back if the write is rejected.
    } catch (caught) {
      setError(toUserFacingError(caught, "That doubt could not be updated. Try again.").message);
    } finally {
      setBusy(null);
    }
  };

  if (!canRunTeacherQuery(access)) return null;

  const doubts = queue ?? [];
  const positionOf = new Map(doubts.map((doubt, index) => [doubt.doubtId, index + 1]));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm"
        aria-expanded={open}
        aria-controls="teacher-doubt-sheet"
        onClick={() => setOpen((previous) => !previous)}
      >
        Doubts
        <span className="ml-1.5 rounded-full border border-border bg-canvas px-1.5 text-[0.65rem] font-medium tabular-nums">
          {queue === undefined ? "–" : doubts.length}
        </span>
      </button>

      <div
        id="teacher-doubt-sheet"
        ref={panelRef}
        role="region"
        aria-label="Anonymous doubts"
        aria-busy={queue === undefined}
        hidden={!open}
        className="absolute right-0 top-0 z-20 flex h-full w-80 max-w-[min(20rem,90vw)] flex-col border-l border-border bg-surface shadow-soft"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold">Doubts</h2>
          <button type="button" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm" onClick={close}>
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
          {error ? (
            <p role="alert" className="mb-3 text-xs leading-5 text-danger">
              {error}
            </p>
          ) : null}

          {queue === undefined ? (
            <p className="text-sm leading-6 text-ink-muted">Loading the queue…</p>
          ) : doubts.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">
              No open doubts yet. Anonymous questions from students will show up here while you teach.
            </p>
          ) : (
            <ul className="space-y-3">
              {doubts.map((doubt, index) => (
                <li key={doubt.doubtId} className="rounded-xl border border-border bg-canvas p-3">
                  <p className="text-xs text-ink-muted">#{index + 1}</p>
                  <p className="leading-5">{doubt.text}</p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {doubt.status} · {doubt.voteCount} same doubt
                    {doubt.status === "uncertain" && doubt.reasonCode ? ` · flagged: ${doubt.reasonCode}` : ""}
                  </p>
                  {/* Duplicates are advisory (docs/14): point at the earlier doubt, never auto-merge. */}
                  {doubt.duplicateOf ? (
                    <p
                      className="mt-1 text-xs text-ink-muted"
                      title="An earlier doubt in this class used the same wording."
                    >
                      {positionOf.has(doubt.duplicateOf)
                        ? `Repeat of #${positionOf.get(doubt.duplicateOf)}`
                        : "Repeat of an earlier doubt"}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busy === doubt.doubtId}
                      className="syncvas-btn syncvas-btn-success min-h-8 px-2 text-xs"
                      onClick={() => void onResolve(doubt.doubtId, "answered")}
                    >
                      {busy === doubt.doubtId ? "Saving…" : "Answered"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === doubt.doubtId}
                      className="syncvas-btn syncvas-btn-ghost min-h-8 px-2 text-xs"
                      onClick={() => void onResolve(doubt.doubtId, "dismissed")}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
