"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { participantStorageKey } from "@/lib/local-teacher";
import { useMutation, useQuery } from "convex/react";
import { DoubtVoteButton } from "./doubt-vote-button";
import { FormEvent, useState } from "react";

export function StudentDoubtComposer({ sessionId }: { sessionId: string }) {
  const submit = useMutation(api.doubts.submit);
  const openDoubts = useQuery(
    api.doubts.listOpen,
    sessionId === "proof-session" ? "skip" : { sessionId: sessionId as Id<"sessions"> },
  );
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const participantId = window.sessionStorage.getItem(participantStorageKey(sessionId));
    if (!participantId) { setMessage("Join this class again before sending a doubt."); return; }
    if (!text.trim()) { setMessage("Write a question first."); return; }
    setBusy(true); setMessage(null);
    try {
      const result = await submit({ sessionId: sessionId as Id<"sessions">, participantId: participantId as Id<"participants">, text });
      setText("");
      setMessage(result.status === "rejected" ? "That message was filtered as noise." : "Doubt sent anonymously.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message.split(": ").slice(1).join(": ") || "Could not send doubt." : "Could not send doubt.");
    } finally { setBusy(false); }
  }

  return (
    <form className="border-t border-border bg-surface p-3 sm:px-4" onSubmit={(event) => void onSubmit(event)}>
      <label className="block text-sm font-medium" htmlFor="doubt-text">Ask anonymously
        <textarea id="doubt-text" value={text} onChange={(event) => setText(event.target.value)} className="syncvas-control mt-2 w-full resize-none text-sm" maxLength={220} rows={2} placeholder="What is unclear right now?" disabled={busy} />
      </label>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted" aria-live="polite">{message ?? "Your name stays hidden from the teacher."}</p>
        <button type="submit" disabled={busy} className="syncvas-btn syncvas-btn-primary">{busy ? "Sending…" : "Send doubt"}</button>
      </div>
      {openDoubts?.length ? <div className="mt-3 space-y-2"><p className="text-xs font-medium text-ink-muted">Questions classmates share</p>{openDoubts.slice(0, 3).map((doubt) => <div key={doubt.doubtId} className="flex items-start justify-between gap-2 rounded-lg bg-canvas px-2 py-2 text-xs"><span>{doubt.text}</span><DoubtVoteButton doubtId={doubt.doubtId} sessionId={sessionId} voteCount={doubt.voteCount} /></div>)}</div> : null}
    </form>
  );
}
