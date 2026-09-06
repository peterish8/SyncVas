"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export function TeacherDoubtQueue({ sessionId }: { sessionId: string }) {
  const queue = useQuery(api.doubts.listTeacherQueueAsLocalTeacher, { sessionId: sessionId as Id<"sessions"> });
  const resolve = useMutation(api.doubts.resolveAsLocalTeacher);
  const [busy, setBusy] = useState<string | null>(null);
  // Duplicates are advisory (docs/14): point the teacher at the earlier doubt, never auto-merge.
  const positionOf = new Map((queue ?? []).map((doubt, index) => [doubt.doubtId, index + 1]));
  return (
    <aside className="w-80 border-l border-border bg-surface p-3 text-sm" aria-label="Anonymous doubts">
      <h2 className="font-semibold">Doubts</h2>
      {!queue?.length ? <p className="mt-3 text-ink-muted">No open doubts yet.</p> : (
        <ul className="mt-3 space-y-3">
          {queue.map((doubt, index) => (
            <li key={doubt.doubtId} className="rounded-xl border border-border bg-canvas p-3">
              <p className="text-xs text-ink-muted">#{index + 1}</p>
              <p className="leading-5">{doubt.text}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {doubt.status} · {doubt.voteCount} same doubt
                {doubt.status === "uncertain" && doubt.reasonCode ? ` · flagged: ${doubt.reasonCode}` : ""}
              </p>
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
                <button type="button" disabled={busy === doubt.doubtId} className="syncvas-btn syncvas-btn-success min-h-8 px-2 text-xs" onClick={() => { setBusy(doubt.doubtId); void resolve({ doubtId: doubt.doubtId, action: "answered" }).finally(() => setBusy(null)); }}>Answered</button>
                <button type="button" disabled={busy === doubt.doubtId} className="syncvas-btn syncvas-btn-ghost min-h-8 px-2 text-xs" onClick={() => { setBusy(doubt.doubtId); void resolve({ doubtId: doubt.doubtId, action: "dismissed" }).finally(() => setBusy(null)); }}>Dismiss</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
