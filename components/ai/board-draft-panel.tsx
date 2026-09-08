/**
 * @phase 12
 * AI draft review gate — AIB-01.
 *
 * Generated content never publishes to a live room. The teacher accepts it into
 * their prepared-board library, or discards it and nothing is left behind.
 */

"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { buildLessonDraft, type LessonDraft } from "@/lib/ai/lesson-authoring";
import type { BoardDraftBlock } from "@/lib/ai/board-authoring-adapter";

import { SyncvasSelect } from "@/components/ui/syncvas-select";

type DraftState = {
  topic: string;
  draft: LessonDraft;
  blocks: BoardDraftBlock[];
};

const UNAVAILABLE_COPY = "AI drafting is not configured.";

export function BoardDraftPanel({ onUseDraft }: { onUseDraft?: (scene: unknown, title: string) => void }) {
  const requestDraft = useAction(
    api.boardAuthoring.draft,
  );
  const saveTemplate = useMutation(
    api.boardTemplates.save,
  );

  const [topic, setTopic] = useState("");
  const [detail, setDetail] = useState<"light" | "standard">("standard");
  const [writingZones, setWritingZones] = useState(2);
  const [state, setState] = useState<"idle" | "drafting" | "saving">("idle");
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const trimmed = topic.trim();
    if (trimmed.length < 3) {
      setError("Describe the lesson in a few words first.");
      return;
    }
    setState("drafting");
    setError(null);
    setUnavailable(false);
    try {
      const result = await requestDraft({ topic: trimmed, detail, writingZones });
      if (result.status !== "ok") {
        // Not an error dialog: the manual path is still fully available.
        setUnavailable(true);
        setPending(null);
        return;
      }
      setPending({ topic: trimmed, blocks: result.blocks, draft: buildLessonDraft(result.blocks, result.writingZones) });
    } catch {
      setUnavailable(true);
    } finally {
      setState("idle");
    }
  };

  const accept = async () => {
    if (!pending) return;
    setState("saving");
    setError(null);
    try {
      const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
      const elements = convertToExcalidrawElements(
        pending.draft.elements as Parameters<typeof convertToExcalidrawElements>[0],
        { regenerateIds: true },
      );
      const sceneJson = JSON.stringify({ elements, appState: { viewBackgroundColor: "#fffefa" } });
      await saveTemplate({ title: pending.topic.slice(0, 120), sceneJson, origin: "ai-assisted" });
      onUseDraft?.({ elements }, pending.topic);
      setPending(null);
      setTopic("");
    } catch {
      setError("That draft could not be saved.");
    } finally {
      setState("idle");
    }
  };

  const busy = state !== "idle";

  return (
    <section aria-label="AI board draft" className="text-sm">
      <h3 className="text-sm font-medium tracking-[-0.02em] text-ink">Draft a board with AI</h3>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        Describe the lesson, choose detail and writing space, then review before saving.
      </p>

      <div className="mt-3 grid gap-3 rounded-card border border-border bg-surface p-3 shadow-soft sm:p-4">
        <div className="syncvas-field">
          <label className="syncvas-label" htmlFor="draft-topic">
            Lesson topic
          </label>
          <input
            id="draft-topic"
            className="syncvas-control"
            placeholder="completing the square, class 9"
            value={topic}
            disabled={busy}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void generate();
            }}
          />
        </div>

        <div className="syncvas-field-row">
          <SyncvasSelect
            id="draft-detail"
            label="Detail"
            value={detail}
            disabled={busy}
            options={[
              { value: "light", label: "Light" },
              { value: "standard", label: "Standard" },
            ]}
            onChange={(next) => setDetail(next === "light" ? "light" : "standard")}
          />

          <SyncvasSelect
            id="draft-writing-space"
            label="Writing space"
            value={String(writingZones)}
            disabled={busy}
            options={[0, 1, 2, 3, 4].map((count) => ({
              value: String(count),
              label: count === 0 ? "None" : `${count} ${count === 1 ? "zone" : "zones"}`,
            }))}
            onChange={(next) => setWritingZones(Number(next))}
          />

          <button
            type="button"
            className="syncvas-btn syncvas-btn-primary w-full sm:w-auto sm:min-w-[8.5rem]"
            disabled={busy}
            onClick={() => void generate()}
          >
            {state === "drafting" ? "Drafting…" : "Draft board"}
          </button>
        </div>
      </div>

      {unavailable ? (
        <p className="mt-3 text-xs leading-5 text-ink-muted">
          {UNAVAILABLE_COPY} Draw the board yourself and save it as a prepared board instead.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-3 rounded-xl border border-border bg-canvas p-3">
          <p className="font-medium leading-5">{pending.topic}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {pending.draft.elements.length} element{pending.draft.elements.length === 1 ? "" : "s"} ·{" "}
            {pending.draft.zones.length} writing zone{pending.draft.zones.length === 1 ? "" : "s"}
            {pending.draft.questions.length > 0
              ? ` · ${pending.draft.questions.length} question${pending.draft.questions.length === 1 ? "" : "s"}`
              : ""}
          </p>

          {pending.draft.warnings.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
              {pending.draft.warnings.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          {pending.draft.elements.length === 0 ? (
            <p className="mt-2 text-xs text-ink-muted">
              This draft came back empty. Try describing the lesson differently.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="syncvas-btn syncvas-btn-primary syncvas-btn-sm"
              disabled={state === "saving" || pending.draft.elements.length === 0}
              onClick={() => void accept()}
            >
              {state === "saving" ? "Saving…" : "Accept as prepared board"}
            </button>
            <button
              type="button"
              className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm"
              onClick={() => setPending(null)}
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
