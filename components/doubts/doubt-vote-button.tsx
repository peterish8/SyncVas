"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { participantStorageKey } from "@/lib/local-teacher";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useMutation } from "convex/react";
import { useState } from "react";

export function DoubtVoteButton({ doubtId, sessionId, voteCount }: { doubtId: string; sessionId: string; voteCount: number }) {
  const vote = useMutation(api.doubts.vote);
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bump, setBump] = useState(false);
  /**
   * The room's own vote is optimistic; the count itself comes from the prop.
   *
   * This used to be `useState(voteCount)`, which snapshots the value at mount.
   * `voteCount` arrives from a reactive query, so when anyone else marked the
   * same doubt the number on screen simply never moved.
   */
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const count = Math.max(voteCount, optimistic ?? voteCount);

  async function onVote() {
    const participantId = window.sessionStorage.getItem(participantStorageKey(sessionId));
    if (!participantId) {
      setMessage("Join this class again before marking the same doubt.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const result = await vote({
        doubtId: doubtId as Id<"doubts">,
        participantId: participantId as Id<"participants">,
      });
      setOptimistic(result.voteCount);
      setVoted(true);
      setMessage("Marked as the same doubt.");
      // Secondary action: the count acknowledges the press on its own.
      setBump(true);
      window.setTimeout(() => setBump(false), 220);
    } catch (error) {
      setMessage(toUserFacingError(error, "Could not mark that doubt. Try again.").message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid justify-items-end gap-1">
      <button
        type="button"
        disabled={voted || busy}
        className="syncvas-btn syncvas-btn-secondary min-h-11 whitespace-nowrap px-3 text-xs"
        data-tooltip={voted ? "You marked this" : "Mark that you have the same question"}
        aria-label={`Same doubt, ${count} ${count === 1 ? "student" : "students"}`}
        onClick={() => void onVote()}
      >
        {busy ? "Saving…" : "Same doubt"}
        <span className="syncvas-count" data-bump={bump ? "" : undefined} aria-hidden="true">
          {count}
        </span>
      </button>
      {message ? (
        <span className="max-w-48 text-right text-xs leading-4 text-ink-muted" role="status" aria-live="polite">
          {message}
        </span>
      ) : null}
    </div>
  );
}
