/**
 * @scaffold true
 * @phase 6
 * End-class finalization UX
 *
 * Confirm → live→ending→ended; capture canonical scene once to _storage.
 * Show progress/failure with retry; never lose active scene on soft failure.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

export function EndClassPanel({ sessionId }: { sessionId: string }) {
  return (
    <div className="rounded border p-3 text-sm" data-session={sessionId}>
      End-class panel scaffold — Phase 6
    </div>
  );
}
