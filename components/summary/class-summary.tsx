/**
 * Post-class notes surface.
 *
 * Reads the stored SummaryResult and renders it. The status machine matters as
 * much as the happy path: a class whose notes are queued, skipped, or failed
 * must still tell the student plainly what happened, because the saved board is
 * the guaranteed deliverable and the notes are not.
 */

"use client";

import { useQuery } from "convex/react";

import { SummaryVisual } from "@/components/summary/summary-visual";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { summaryResultSchema, type SummaryResult } from "@/lib/ai/summary-adapter";

function parseNotes(notesJson: string | null): SummaryResult | null {
  if (!notesJson) return null;
  try {
    const parsed = summaryResultSchema.safeParse(JSON.parse(notesJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Notes are not ready yet",
    body: "The saved board is available now. Summary notes appear here once they finish generating.",
  },
  queued: {
    title: "Notes are queued",
    body: "Generation starts moments after class ends. Refresh in a little while.",
  },
  processing: {
    title: "Writing your notes…",
    body: "This usually takes under a minute.",
  },
  skipped: {
    title: "No notes for this class",
    body: "There was not enough readable content on the board to summarise.",
  },
  failed: {
    title: "Notes could not be generated",
    body: "The saved board and exports are unaffected. Your teacher can retry generation.",
  },
};

function StatusCard({ status }: { status: string }) {
  const copy = STATUS_COPY[status] ?? STATUS_COPY.pending;
  return (
    <div className="rounded-panel border border-border bg-surface-muted p-6">
      <p className="text-base font-medium text-ink">{copy.title}</p>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{copy.body}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h2>
      {children}
    </section>
  );
}

export function ClassSummary({ sessionId }: { sessionId: string }) {
  const summary = useQuery(api.summaries.getForSession, { sessionId: sessionId as Id<"sessions"> });

  if (summary === undefined) {
    return <p className="text-sm text-ink-muted">Loading notes…</p>;
  }

  if (summary === null) {
    return (
      <div className="rounded-panel border border-border bg-surface-muted p-6">
        <p className="text-base font-medium text-ink">Notes are available after class</p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          This class has not ended yet. Summary notes appear here once your teacher ends the session.
        </p>
      </div>
    );
  }

  const notes = parseNotes(summary.notesJson);
  if (!notes) return <StatusCard status={summary.status} />;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="syncvas-eyebrow">Class notes</p>
        <h1 className="text-2xl font-semibold leading-tight text-ink">{notes.title}</h1>
        {notes.overview ? <p className="text-base leading-7 text-ink-muted">{notes.overview}</p> : null}
      </header>

      {notes.topics.length ? (
        <Section title="Topics covered">
          <div className="flex flex-col gap-5">
            {notes.topics.map((topic, index) => (
              <div key={index} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-ink">{topic.name}</h3>
                <ul className="flex flex-col gap-1.5 pl-4">
                  {topic.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="list-disc text-sm leading-6 text-ink-muted marker:text-accent">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {notes.keyConcepts.length ? (
        <Section title="Key concepts">
          <dl className="grid gap-3 sm:grid-cols-2">
            {notes.keyConcepts.map((concept, index) => (
              <div key={index} className="rounded-panel border border-border bg-surface p-4">
                <dt className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {concept.term}
                  {concept.confidence === "uncertain" ? (
                    <span className="syncvas-pill syncvas-pill-warning text-[10px]">unclear on board</span>
                  ) : null}
                </dt>
                <dd className="mt-1.5 text-sm leading-6 text-ink-muted">{concept.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {notes.visuals.length ? (
        <Section title="Diagrams and charts">
          <div className="flex flex-col gap-4">
            {notes.visuals.map((visual, index) => (
              <SummaryVisual key={index} visual={visual} />
            ))}
          </div>
        </Section>
      ) : null}

      {notes.doubtHighlights.length ? (
        <Section title="Questions from the class">
          <div className="flex flex-col gap-3">
            {notes.doubtHighlights.map((doubt, index) => (
              <div key={index} className="rounded-panel border border-border bg-surface p-4">
                <p className="text-sm font-medium text-ink">{doubt.question}</p>
                {doubt.answer ? (
                  <p className="mt-1.5 text-sm leading-6 text-ink-muted">{doubt.answer}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {notes.revisionChecklist.length ? (
        <Section title="Revision checklist">
          <ul className="flex flex-col gap-2">
            {notes.revisionChecklist.map((item, index) => (
              <li key={index} className="flex items-start gap-2.5 text-sm leading-6 text-ink">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {notes.uncertainNotes.length ? (
        <Section title="Could not read from the board">
          <ul className="flex flex-col gap-1.5 pl-4">
            {notes.uncertainNotes.map((item, index) => (
              <li key={index} className="list-disc text-sm leading-6 text-ink-subtle">
                {item}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <footer className="border-t border-border pt-4 text-xs leading-5 text-ink-subtle">
        AI-generated from the saved board. Check anything marked unclear against your own notes.
      </footer>
    </article>
  );
}
