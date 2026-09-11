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
  onFreeRoam: () => void;
};

export function FollowControls({
  followEnabled,
  hasTeacherViewport,
  onFollowTeacher,
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
          className="syncvas-btn syncvas-btn-secondary min-h-11 rounded-full px-3"
          data-tooltip="Pan and zoom on your own"
          onClick={onFreeRoam}
        >
          Explore freely
        </button>
      ) : (
        /**
         * One button, not two. "Follow Teacher" and "Return to Teacher" both
         * rendered here and both called the same handler — two labels for one
         * action, which reads as a broken control rather than a choice.
         */
        <button
          type="button"
          className="syncvas-btn syncvas-btn-secondary min-h-11 rounded-full px-3"
          data-tooltip={
            hasTeacherViewport
              ? "Snap back to the teacher's view and keep following"
              : "Waiting for the teacher's camera"
          }
          onClick={onFollowTeacher}
          disabled={!hasTeacherViewport}
          aria-describedby={hasTeacherViewport ? undefined : "return-teacher-hint"}
        >
          Return to Teacher
        </button>
      )}

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
