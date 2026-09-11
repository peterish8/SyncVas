"use client";

import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { participantStorageKey, roomTokenStorageKey } from "@/lib/local-teacher";
import { toUserFacingError } from "@/lib/user-facing-errors";
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

type JoinIssue = {
  code: string | null;
  message: string;
  recovery?: string;
};

export function JoinCodeForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const join = useMutation(api.participants.joinByCode);
  const issueToken = useAction(api.sessions.issueSocketToken);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [issue, setIssue] = useState<JoinIssue | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    setIssue(null);
    if (!normalized) {
      setIssue({
        code: "EMPTY_CODE",
        message: "Enter the six-character room code.",
        recovery: "It is on the teacher screen or in the QR link.",
      });
      return;
    }
    if (!/^[A-Z2-9]{6}$/.test(normalized)) {
      setIssue({
        code: "INVALID_JOIN_CODE",
        message: "Room codes are six characters (letters and numbers).",
        recovery: "Check for typos — codes are not case-sensitive.",
      });
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
      setIssue(toUserFacingError(joinError, "We could not join that class. Check the code and try again."));
    } finally {
      setBusy(false);
    }
  }

  const ended = issue?.code === "SESSION_ENDED";
  const notLive = issue?.code === "SESSION_NOT_LIVE";

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
          disabled={busy}
          aria-invalid={Boolean(issue)}
          aria-describedby={issue ? "join-code-error" : "join-code-hint"}
        />
      </label>
      <button type="submit" disabled={busy} className="syncvas-btn syncvas-btn-primary w-full">
        {busy ? "Joining…" : "Join class"}
      </button>
      {issue ? (
        <div
          id="join-code-error"
          role="alert"
          className="rounded-xl bg-danger-soft px-3 py-3 text-sm text-danger"
        >
          <p className="font-medium">{issue.message}</p>
          {issue.recovery ? <p className="mt-1 text-xs leading-5 opacity-90">{issue.recovery}</p> : null}
          {ended || notLive ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm">
                Back home
              </Link>
              {!ended ? (
                <button
                  type="button"
                  className="syncvas-btn syncvas-btn-secondary syncvas-btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setIssue(null);
                    const form = document.getElementById("join-code")?.closest("form");
                    form?.requestSubmit();
                  }}
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <p id="join-code-hint" className="text-xs leading-5 text-ink-muted">
        Your name is not shown to the teacher. A temporary anonymous ID helps prevent spam.
      </p>
    </form>
  );
}
