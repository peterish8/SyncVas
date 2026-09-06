"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { participantStorageKey } from "@/lib/local-teacher";
import { useMutation } from "convex/react";
import { useState } from "react";

export function DoubtVoteButton({ doubtId, sessionId, voteCount }: { doubtId: string; sessionId: string; voteCount: number }) {
  const vote = useMutation(api.doubts.vote);
  const [count, setCount] = useState(voteCount);
  const [voted, setVoted] = useState(false);
  return <button type="button" disabled={voted} className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-ink disabled:opacity-60" onClick={() => { const participantId = window.sessionStorage.getItem(participantStorageKey(sessionId)); if (!participantId) return; void vote({ doubtId: doubtId as Id<"doubts">, participantId: participantId as Id<"participants"> }).then((result) => { setCount(result.voteCount); setVoted(true); }); }}>Same doubt ({count})</button>;
}
