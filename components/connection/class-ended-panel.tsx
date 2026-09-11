/**
 * @phase 8
 * Terminal "class ended" state for the live board.
 *
 * Shown instead of the reconnect banner once the relay revokes the room
 * (`ROOM_REVOKED`) or Convex refuses a fresh token because the session ended
 * (`SESSION_ENDED` / `SESSION_NOT_LIVE`). Nothing here reconnects: the class is
 * over, so the only useful actions are forward ones.
 *
 * Positioned to cover its nearest positioned ancestor (the board frame, which
 * is `position: relative`), the same way the other board overlays are.
 */

"use client";

import Link from "next/link";

export function ClassEndedPanel({ role, sessionId }: { role: "teacher" | "student"; sessionId: string }) {
  const notesHref = `/student/${encodeURIComponent(sessionId)}/notes`;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-panel border border-border bg-surface p-6 text-center shadow-soft"
        role="status"
        aria-live="polite"
      >
        <p className="syncvas-eyebrow">Class ended</p>
        <p className="mt-2 text-base font-medium">This class has ended</p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {role === "student"
            ? "The teacher closed the room. The final board and notes are saved."
            : "The room is closed and the final board is saved."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {role === "student" ? (
            <>
              <Link href={notesHref} className="syncvas-btn syncvas-btn-primary">
                Read class notes
              </Link>
              <Link href="/join" className="syncvas-btn syncvas-btn-secondary">
                Join another class
              </Link>
            </>
          ) : (
            <Link href="/teacher" className="syncvas-btn syncvas-btn-primary">
              Back to your classes
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
