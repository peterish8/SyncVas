/**
 * Teacher view of the generated notes, with retry.
 *
 * docs/15 requires the teacher to be able to regenerate: the model can misread
 * handwriting, and a failed provider call should not be terminal. Regeneration
 * reuses the stored final board, so it never needs the class to be live.
 */

"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** Same dev-only gate the other teacher surfaces use. */

const STATUS_LABEL: Record<string, string> = {
  pending: "Not generated",
  queued: "Queued",
  processing: "Generating…",
  ready: "Ready",
  failed: "Failed",
  skipped: "Skipped",
};

const ERROR_HINT: Record<string, string> = {
  SUMMARY_PROVIDER_DISABLED: "No AI provider is configured. Set AI_PROVIDER and the API key on the Convex deployment.",
  SUMMARY_PROVIDER_UNAVAILABLE: "The AI provider did not respond. Retry in a moment.",
  SUMMARY_PROVIDER_INVALID_RESULT: "The AI provider returned an unusable response. Retry.",
  SUMMARY_EMPTY_BOARD: "The board had too little readable content to summarise.",
  SUMMARY_INPUT_INVALID: "The saved board could not be prepared for summarising.",
};

export function TeacherNotesPanel({ sessionId }: { sessionId: string }) {
  const summary = useQuery(
    api.summaries.getForTeacher,
    { sessionId: sessionId as Id<"sessions"> },
  );
  const regenerate = useMutation(
    api.summaries.regenerate,
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRegenerate = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await regenerate({ sessionId: sessionId as Id<"sessions"> });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start generation.");
    } finally {
      setPending(false);
    }
  }, [regenerate, sessionId]);

  if (summary === undefined) {
    return <p className="text-sm text-ink-muted">Loading notes status…</p>;
  }

  const status = summary.status;
  const busy = pending || status === "processing" || status === "queued";

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-ink">AI class notes</p>
          <p className="text-xs text-ink-muted">
            {STATUS_LABEL[status] ?? status}
            {summary.provider ? ` · ${summary.provider}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="syncvas-btn syncvas-btn-secondary syncvas-btn-sm"
          onClick={onRegenerate}
          disabled={busy}
        >
          {status === "ready" ? "Regenerate" : "Generate"}
        </button>
      </div>

      {summary.errorCode ? (
        <p className="text-xs leading-5 text-ink-muted">
          {ERROR_HINT[summary.errorCode] ?? summary.errorCode}
        </p>
      ) : null}

      {error ? <p className="text-xs leading-5 text-danger">{error}</p> : null}

      {status === "ready" ? (
        <a
          className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm w-fit"
          href={`/student/${sessionId}/notes`}
          target="_blank"
          rel="noreferrer"
        >
          Preview student notes
        </a>
      ) : null}
    </div>
  );
}
