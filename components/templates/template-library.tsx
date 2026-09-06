/**
 * @phase 11
 * Prepared board library — PREP-02, PREP-03.
 *
 * The teacher picks a prepared board before the class starts. Opening one only
 * hands the scene back to the page; publishing it is the board path's job.
 */

"use client";

import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type PreparedBoard = {
  templateId: Id<"boardTemplates">;
  title: string;
  scene: unknown;
};

type TemplateSummary = {
  templateId: Id<"boardTemplates">;
  title: string;
  subject?: string;
  origin: "authored" | "ai-assisted";
  updatedAt: number;
};

function formatUpdated(updatedAt: number): string {
  return new Date(updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TemplateLibrary({
  onOpen,
  disabled,
}: {
  onOpen: (board: PreparedBoard) => void;
  disabled?: boolean;
}) {
  const templates = useQuery(api.boardTemplates.listAsLocalTeacher, {}) as TemplateSummary[] | undefined;
  const renameTemplate = useMutation(api.boardTemplates.renameAsLocalTeacher);
  const removeTemplate = useMutation(api.boardTemplates.removeAsLocalTeacher);
  // The scene is fetched on demand, so the library listing stays lightweight.
  const convex = useConvex();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = async (template: TemplateSummary) => {
    setBusyId(template.templateId);
    setError(null);
    try {
      const opened = await convex.query(api.boardTemplates.getStartingSceneAsLocalTeacher, {
        templateId: template.templateId,
      });
      onOpen({ templateId: template.templateId, title: opened.title, scene: JSON.parse(opened.sceneJson) });
    } catch {
      setError("That prepared board could not be opened.");
    } finally {
      setBusyId(null);
    }
  };

  const commitRename = async (templateId: Id<"boardTemplates">) => {
    const title = draftTitle.trim();
    if (!title) return;
    setBusyId(templateId);
    setError(null);
    try {
      await renameTemplate({ templateId, title });
      setRenamingId(null);
    } catch {
      setError("That name could not be saved.");
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (templateId: Id<"boardTemplates">) => {
    setBusyId(templateId);
    setError(null);
    try {
      await removeTemplate({ templateId });
    } catch {
      setError("That prepared board could not be deleted.");
    } finally {
      setBusyId(null);
    }
  };

  if (templates === undefined) {
    return (
      <section aria-label="Prepared boards" aria-busy="true" className="text-sm text-ink-muted">
        <h3 className="text-sm font-medium text-ink">Prepared boards</h3>
        <p className="mt-2">Loading your library…</p>
      </section>
    );
  }

  return (
    <section aria-label="Prepared boards" className="text-sm">
      <h3 className="text-sm font-medium text-ink">Prepared boards</h3>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <p className="mt-2 text-ink-muted">
          Nothing saved yet. Draw a board, then use <span className="font-medium">Save as prepared board</span> to
          reuse it next class.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {templates.map((template) => (
            <li key={template.templateId} className="rounded-xl border border-border bg-canvas p-2">
              {renamingId === template.templateId ? (
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`rename-${template.templateId}`}>
                    New name for {template.title}
                  </label>
                  <input
                    id={`rename-${template.templateId}`}
                    className="syncvas-input min-h-8 flex-1 text-xs"
                    value={draftTitle}
                    autoFocus
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void commitRename(template.templateId);
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                  />
                  <button
                    type="button"
                    className="syncvas-btn syncvas-btn-sm"
                    disabled={busyId === template.templateId}
                    onClick={() => void commitRename(template.templateId)}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-medium leading-5">{template.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {template.subject ? `${template.subject} · ` : ""}
                    {template.origin === "ai-assisted" ? "AI draft · " : ""}
                    {formatUpdated(template.updatedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="syncvas-btn syncvas-btn-sm"
                      disabled={disabled || busyId === template.templateId}
                      onClick={() => void open(template)}
                    >
                      Start class on this
                    </button>
                    <button
                      type="button"
                      className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm"
                      disabled={busyId === template.templateId}
                      onClick={() => {
                        setRenamingId(template.templateId);
                        setDraftTitle(template.title);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm"
                      disabled={busyId === template.templateId}
                      onClick={() => void discard(template.templateId)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
