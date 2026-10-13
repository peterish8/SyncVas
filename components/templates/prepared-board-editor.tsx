"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { api } from "@/convex/_generated/api";
import { serializeFinalBoardScene } from "@/lib/final-board-scene";
import type { PreparedBoard } from "./template-library";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((module) => module.Excalidraw), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-ink-muted">Loading preparation canvas…</div>,
});

/** A private canvas: saving selects an opening board, without a live socket. */
export function PreparedBoardEditor({ initialBoard, onSaved, onClose }: {
  initialBoard: PreparedBoard | null;
  onSaved: (board: PreparedBoard) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const save = useMutation(api.boardTemplates.save);
  const [title, setTitle] = useState(initialBoard?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [theme] = useState<"dark" | "light">(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const source = initialBoard?.scene as { elements?: ExcalidrawElement[] } | undefined;

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const submit = async () => {
    if (busy || !canvasRef.current) return;
    if (!title.trim()) { setError("Give your prepared board a name."); return; }
    setBusy(true); setError(null);
    const scene = {
      elements: canvasRef.current.getSceneElements(),
      appState: { viewBackgroundColor: canvasRef.current.getAppState().viewBackgroundColor },
    };
    try {
      const saved = await save({ title: title.trim(), sceneJson: serializeFinalBoardScene(scene) });
      onSaved({ ...saved, scene });
    } catch {
      setError("Your board could not be saved. Keep this canvas open and try again.");
    } finally { setBusy(false); }
  };

  return (
    <dialog ref={dialogRef} className="syncvas-preparation-dialog" aria-labelledby="preparation-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="syncvas-preparation-header">
        <div><p className="syncvas-eyebrow">Before the lesson</p><h2 id="preparation-title">Prepare your board</h2></div>
        <button type="button" className="syncvas-btn syncvas-btn-ghost" disabled={busy} onClick={onClose}>Close</button>
      </div>
      <form className="syncvas-preparation-toolbar" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="preparation-name">Board name</label>
        <input id="preparation-name" className="syncvas-control" placeholder="Week 2 · Completing the square" value={title} maxLength={120} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
        <button className="syncvas-btn syncvas-btn-primary" disabled={busy || !ready} type="submit">{busy ? "Saving…" : "Save and use this board"}</button>
        <p>Private until you start a room.</p>
      </form>
      {error ? <p role="alert" className="px-5 py-2 text-sm text-danger">{error}</p> : null}
      <div className="syncvas-preparation-canvas">
        <Excalidraw excalidrawAPI={(canvas) => { canvasRef.current = canvas; setReady(true); }}
          initialData={{ elements: Array.isArray(source?.elements) ? source.elements : [], appState: { theme } }}
          theme={theme} UIOptions={{ tools: { image: false } }} />
      </div>
    </dialog>
  );
}
