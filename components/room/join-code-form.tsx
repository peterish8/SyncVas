"use client";

import { api } from "@/convex/_generated/api";
import { participantStorageKey, roomTokenStorageKey } from "@/lib/local-teacher";
import { useAction, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const ANONYMOUS_SECRET_KEY = "syncvas:anonymous-secret:v1";

function getAnonymousProof(): string {
  const existing = window.localStorage.getItem(ANONYMOUS_SECRET_KEY);
  if (existing && existing.length >= 16) return existing;
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const proof = `${crypto.randomUUID()}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  window.localStorage.setItem(ANONYMOUS_SECRET_KEY, proof);
  return proof;
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("SESSION_ENDED")) return "That class has ended. Ask the teacher for a new code.";
  if (message.includes("SESSION_NOT_LIVE")) return "That class is not open yet.";
  if (message.includes("SESSION_NOT_FOUND") || message.includes("INVALID_JOIN_CODE")) {
    return "Check the six-character code and try again.";
  }
  return "We could not join that class. Check the code and try again.";
}

export function JoinCodeForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const join = useMutation(api.participants.joinByCode);
  const issueToken = useAction(api.sessions.issueSocketToken);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    setError(null);
    if (!/^[A-Z2-9]{6}$/.test(normalized)) {
      setError("Enter the six-character room code.");
      return;
    }
    setBusy(true);
    try {
      const admission = await join({ code: normalized, anonymousProof: getAnonymousProof() });
      const { token } = await issueToken({
        sessionId: admission.sessionId,
        participantId: admission.participantId,
      });
      window.sessionStorage.setItem(participantStorageKey(admission.sessionId), admission.participantId);
      window.sessionStorage.setItem(roomTokenStorageKey(admission.sessionId), token);
      router.push(`/student/${admission.sessionId}`);
    } catch (joinError) {
      setError(readableError(joinError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="join-code">
        Join code
        <input
          id="join-code"
          className="syncvas-control w-full font-mono text-center text-2xl font-semibold uppercase tracking-[0.28em]"
          name="code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\s/g, "").slice(0, 6).toUpperCase())
          }
          maxLength={6}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="ABC234"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "join-code-error" : "join-code-hint"}
        />
      </label>
      <button type="submit" disabled={busy} className="syncvas-btn syncvas-btn-primary w-full">
        {busy ? "Joining…" : "Join class"}
      </button>
      {error ? (
        <p id="join-code-error" role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p id="join-code-hint" className="text-xs leading-5 text-ink-muted">
        Your name is not shown to the teacher. A temporary anonymous ID helps prevent spam.
      </p>
    </form>
  );
}
