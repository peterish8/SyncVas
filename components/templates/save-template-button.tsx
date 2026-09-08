/**
 * @phase 11
 * Save the board currently on screen as a reusable prepared board — PREP-01.
 */

"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { serializeFinalBoardScene } from "@/lib/final-board-scene";

export function SaveTemplateButton({
  getScene,
  subject,
  defaultTitle,
}: {
  /** Returns the scene as it stands right now, or null when the board is empty. */
  getScene: () => unknown;
  subject?: string;
  defaultTitle?: string;
}) {
  const saveTemplate = useMutation(
    api.boardTemplates.save,
  );
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the prepared board a name.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      await saveTemplate({ title: trimmed, subject, sceneJson: serializeFinalBoardScene(getScene()) });
      setStatus("saved");
      setOpen(false);
      setTitle("");
    } catch (caught) {
      setStatus("idle");
      // Surface the stable code, never the internals behind it.
      const code = caught instanceof Error ? caught.message.split(":")[0] : "";
      setError(
        code === "SCENE_TOO_LARGE"
          ? "This board is too large to save as a prepared board."
          : "That prepared board could not be saved.",
      );
    }
  };

  if (!open) {
    return (
      <button type="button" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm" onClick={() => setOpen(true)}>
        {status === "saved" ? "Saved · save again" : "Save as prepared board"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="prepared-board-title">
        Prepared board name
      </label>
      <input
        id="prepared-board-title"
        className="syncvas-input min-h-8 w-44 text-xs"
        placeholder="Week 2 opener"
        value={title}
        autoFocus
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
          if (event.key === "Escape") setOpen(false);
        }}
      />
      <button
        type="button"
        className="syncvas-btn syncvas-btn-sm"
        disabled={status === "saving"}
        onClick={() => void submit()}
      >
        {status === "saving" ? "Saving…" : "Save"}
      </button>
      <button type="button" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
