/**
 * Follow Teacher / free-roam UI
 *
 * Accessible text state: Following | Free roam — not color alone.
 * Toggle follow; Return to Teacher; keyboard reachable.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

export type FollowControlsProps = {
  followEnabled: boolean;
  hasTeacherViewport: boolean;
  onFollowTeacher: () => void;
  onReturnToTeacher: () => void;
  onFreeRoam: () => void;
};

export function FollowControls({
  followEnabled,
  hasTeacherViewport,
  onFollowTeacher,
  onReturnToTeacher,
  onFreeRoam,
}: FollowControlsProps) {
  const statusLabel = followEnabled ? "Following" : "Free roam";

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm"
      role="region"
      aria-label="Teacher follow controls"
    >
      <span className="font-medium text-ink" aria-live="polite">
        {statusLabel}
      </span>
      <span className="text-ink-muted" aria-hidden="true">
        ·
      </span>
      <span className="sr-only">Navigation mode: {statusLabel}</span>

      {followEnabled ? (
        <button
          type="button"
          className="min-h-11 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={onFreeRoam}
        >
          Explore freely
        </button>
      ) : (
        <button
          type="button"
          className="min-h-11 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={onFollowTeacher}
        >
          Follow Teacher
        </button>
      )}

      {!followEnabled ? (
        <button
          type="button"
          className="min-h-11 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onReturnToTeacher}
          disabled={!hasTeacherViewport}
          aria-describedby={
            hasTeacherViewport ? undefined : "return-teacher-hint"
          }
        >
          Return to Teacher
        </button>
      ) : null}

      {!followEnabled && !hasTeacherViewport ? (
        <span id="return-teacher-hint" className="text-xs text-ink-muted">
          Waiting for teacher camera…
        </span>
      ) : null}

      {!followEnabled && hasTeacherViewport ? (
        <span className="text-xs text-ink-muted">You’re exploring</span>
      ) : null}
    </div>
  );
}
