"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { participantStorageKey } from "@/lib/local-teacher";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useStoredValue } from "@/lib/client-store";
import { useMutation, useQuery } from "convex/react";
import { DoubtVoteButton } from "./doubt-vote-button";
import { FormEvent, useState } from "react";

export function StudentDoubtComposer({ sessionId }: { sessionId: string }) {
  const submit = useMutation(api.doubts.submit);
  // The doubt list is now admission-checked, so the participant capability has
  // to be read at render time rather than only on submit.
  const storedParticipantId = useStoredValue<string | null>({
    storage: "session",
    key: participantStorageKey(sessionId),
    parse: (raw) => (typeof raw === "string" && raw ? raw : null),
    serverValue: null,
  });
  const openDoubts = useQuery(
    api.doubts.listOpen,
    sessionId === "proof-session" || !storedParticipantId
      ? "skip"
      : {
          sessionId: sessionId as Id<"sessions">,
          participantId: storedParticipantId as Id<"participants">,
        },
  );
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const participantId = window.sessionStorage.getItem(participantStorageKey(sessionId));
    if (!participantId) {
      setTone("error");
      setMessage("Join this class again before sending a doubt.");
      return;
    }
    if (!text.trim()) {
      setTone("error");
      setMessage("Write a question first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await submit({
        sessionId: sessionId as Id<"sessions">,
        participantId: participantId as Id<"participants">,
        text,
      });
      setText("");
      if (result.status === "rejected") {
        setTone("error");
        setMessage("That message was filtered. Try a clearer question about the lesson.");
      } else if (result.duplicateOf) {
        setTone("success");
        setMessage("Sent — this matches an earlier question, so the teacher can see the repeat.");
      } else {
        setTone("success");
        setMessage("Doubt sent anonymously.");
      }
    } catch (error) {
      const facing = toUserFacingError(error, "Could not send doubt.");
      setTone("error");
      setMessage(facing.message);
    } finally {
      setBusy(false);
    }
  }

  const hintClass =
    tone === "error" ? "text-danger" : tone === "success" ? "text-ink" : "text-ink-muted";
  const feedbackId = "doubt-feedback";
  const hintId = "doubt-hint";
  const remainingCharacters = 220 - text.length;

  return (
    <form className="syncvas-student-doubt-panel" onSubmit={(event) => void onSubmit(event)}>
      <header className="syncvas-doubt-panel-header">
        <div>
          <p className="syncvas-doubt-panel-eyebrow">Student signal</p>
          <h2>Ask quietly</h2>
        </div>
        <span className="syncvas-doubt-anonymous">Anonymous</span>
      </header>
      <p className="syncvas-doubt-panel-intro">
        Your teacher sees the question, never your name.
      </p>
      <label className="syncvas-doubt-field" htmlFor="doubt-text">
        <span>What is unclear?</span>
        <textarea
          id="doubt-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="syncvas-control"
          maxLength={220}
          rows={4}
          placeholder="Ask about the step you are looking at…"
          disabled={busy}
          aria-invalid={tone === "error" && Boolean(message)}
          aria-describedby={`${hintId} ${feedbackId}`}
        />
      </label>
      <div className="syncvas-doubt-submit-row">
        <p id={feedbackId} className={`text-xs leading-5 ${hintClass}`} aria-live="polite" aria-atomic="true">
          {message ?? "Your name stays hidden from the teacher."}
        </p>
        <button type="submit" disabled={busy} className="syncvas-btn syncvas-btn-primary min-h-11">
          {busy ? "Sending…" : "Send doubt"}
        </button>
      </div>
      <p id={hintId} className="syncvas-doubt-counter" aria-live="polite">
        {remainingCharacters} characters left
      </p>
      <section className="syncvas-doubt-feed" aria-labelledby="class-doubts-title">
        <div className="syncvas-doubt-feed-header">
          <p id="class-doubts-title">Class questions</p>
          <span>{openDoubts?.length ?? 0}</span>
        </div>
        {openDoubts?.length ? (
          <div className="syncvas-doubt-list">
          {openDoubts.slice(0, 3).map((doubt) => (
            <div
              key={doubt.doubtId}
              className="syncvas-doubt-card"
            >
              <span>{doubt.text}</span>
              <DoubtVoteButton
                doubtId={doubt.doubtId}
                sessionId={sessionId}
                voteCount={doubt.voteCount}
              />
            </div>
          ))}
          </div>
        ) : (
          <p className="syncvas-doubt-empty">No open questions yet. Yours can be the first.</p>
        )}
      </section>
    </form>
  );
}
