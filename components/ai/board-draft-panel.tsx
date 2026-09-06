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

type DraftState = {
  topic: string;
  draft: LessonDraft;
  blocks: BoardDraftBlock[];
};

const UNAVAILABLE_COPY = "AI drafting is not configured.";

export function BoardDraftPanel({ onUseDraft }: { onUseDraft?: (scene: unknown, title: string) => void }) {
  const requestDraft = useAction(api.boardAuthoring.draftAsLocalTeacher);
  const saveTemplate = useMutation(api.boardTemplates.saveAsLocalTeacher);

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

  return (
    <section aria-label="AI board draft" className="text-sm">
      <h3 className="text-sm font-medium text-ink">Draft a board with AI</h3>

      <div className="mt-2 space-y-2">
        <label className="sr-only" htmlFor="draft-topic">
          Lesson topic
        </label>
        <input
          id="draft-topic"
          className="syncvas-input min-h-9 w-full text-xs"
          placeholder="completing the square, class 9"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void generate();
          }}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            Detail
            <select
              className="syncvas-input min-h-8 text-xs"
              value={detail}
              onChange={(event) => setDetail(event.target.value === "light" ? "light" : "standard")}
            >
              <option value="light">Light</option>
              <option value="standard">Standard</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Writing space
            <select
              className="syncvas-input min-h-8 text-xs"
              value={writingZones}
              onChange={(event) => setWritingZones(Number(event.target.value))}
            >
              {[0, 1, 2, 3, 4].map((count) => (
                <option key={count} value={count}>
                  {count === 0 ? "None" : `${count} ${count === 1 ? "zone" : "zones"}`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="syncvas-btn syncvas-btn-sm"
            disabled={state !== "idle"}
            onClick={() => void generate()}
          >
            {state === "drafting" ? "Drafting…" : "Draft board"}
          </button>
        </div>
      </div>

      {unavailable ? (
        <p className="mt-2 text-xs text-ink-muted">
          {UNAVAILABLE_COPY} Draw the board yourself and save it as a prepared board instead.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
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
              className="syncvas-btn syncvas-btn-sm"
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
