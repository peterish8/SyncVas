/**
 * @scaffold true
 * @phase 8
 * Reconnect / resync UX
 *
 * On reconnect: refresh token → rejoin room → board:request-current → reconcile version.
 * Do not replay student local edits as teacher. Preserve follow/free-roam choice.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

export function ReconnectBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="bg-amber-50 px-3 py-2 text-sm">
      Connection issue.{" "}
      <button type="button" className="underline" onClick={onRetry}>
        Reconnect
      </button>
    </div>
  );
}
