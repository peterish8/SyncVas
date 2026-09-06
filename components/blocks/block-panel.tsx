"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { compileBlock, listBlockGrammars } from "@/lib/blocks/registry";
import { BlockCompileError, type BlockCompileResult, type BlockGrammarId, type BlockOptions, type BlockTheme } from "@/lib/blocks/types";

type Snippet = { id: string; grammar: BlockGrammarId; source: string; options: BlockOptions };
const SNIPPETS_KEY = "syncvas:block-snippets:v1";
const themes: BlockTheme[] = ["one-dark-pro", "github-light", "github-dark", "nord", "catppuccin-latte", "monokai"];
const languages = ["TypeScript", "JavaScript", "Python", "Java", "C++", "SQL"];

export function BlockPanel({ onInsert, onHighlight, boardTheme }: { onInsert: (result: BlockCompileResult) => void; onHighlight?: (highlight: { blockId: string; startLine: number; endLine?: number }) => void; boardTheme: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [grammar, setGrammar] = useState<BlockGrammarId>("mermaid");
  const [source, setSource] = useState("flowchart LR\n  Teacher --> Student");
  const [theme, setTheme] = useState<BlockTheme>(boardTheme === "dark" ? "github-dark" : "github-light");
  const [language, setLanguage] = useState("TypeScript");
  const [focus, setFocus] = useState("");
  const [lineNumbers, setLineNumbers] = useState(true);
  const [diff, setDiff] = useState(false);
  const [reveal, setReveal] = useState<"all" | "step">("all");
  const [result, setResult] = useState<BlockCompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SNIPPETS_KEY) ?? "[]") as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is Snippet => Boolean(item && typeof item === "object" && "source" in item && "grammar" in item)).slice(0, 30)
        : [];
    } catch { return []; }
  });

  const grammarOptions = useMemo(() => listBlockGrammars(), []);
  function render() {
    setError(null);
    try {
      const compiled = compileBlock({ grammar, source, options: { theme, language, focus: focus || undefined, lineNumbers, diff, reveal } });
      setResult(compiled);
    } catch (compileError) {
      setResult(null);
      setError(compileError instanceof BlockCompileError ? compileError.message : "That block could not be rendered.");
    }
  }
  function insert() {
    if (!result) return;
    onInsert(result);
    setOpen(false);
  }
  function broadcastPointer() {
    if (!result || !onHighlight) return;
    const firstLine = Math.max(1, Number(result.options.step ?? 1));
    onHighlight({
      blockId: `${result.grammar}-${result.source.length}-${result.source.charCodeAt(0) || 0}`,
      startLine: firstLine,
    });
  }
  function saveSnippet() {
    if (!result) return;
    const next: Snippet = { id: `${Date.now()}-${result.grammar}`, grammar: result.grammar, source: result.source, options: result.options };
    const updated = [next, ...snippets.filter((item) => !(item.grammar === next.grammar && item.source === next.source))].slice(0, 30);
    setSnippets(updated);
    window.localStorage.setItem(SNIPPETS_KEY, JSON.stringify(updated));
  }
  function loadSnippet(snippet: Snippet) {
    setGrammar(snippet.grammar); setSource(snippet.source); setTheme((snippet.options.theme as BlockTheme) ?? theme); setLanguage(snippet.options.language ?? "TypeScript"); setFocus(snippet.options.focus ?? ""); setResult(null); setError(null);
  }

  return (
    <>
      <button type="button" className="syncvas-icon-btn" onClick={() => setOpen(true)} aria-label="Open board blocks" title="Insert a compiled board block">
        <span aria-hidden="true">⌘</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Insert board block" className="syncvas-block-modal">
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">Type a compact grammar source and render it into ordinary Excalidraw content. The teacher remains the only editor.</p>
        <div className="mt-5 grid gap-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
            <label className="grid gap-2"><span className="syncvas-label">Grammar</span><select className="syncvas-control" value={grammar} onChange={(event) => setGrammar(event.target.value as BlockGrammarId)}>{grammarOptions.map((item) => <option key={item} value={item}>/{item}</option>)}</select></label>
            <label className="grid gap-2"><span className="syncvas-label">Theme</span><select className="syncvas-control" value={theme} onChange={(event) => setTheme(event.target.value as BlockTheme)}>{themes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          {grammar === "code" ? <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-2"><span className="syncvas-label">Language</span><select className="syncvas-control" value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="grid gap-2"><span className="syncvas-label">Focus lines</span><input className="syncvas-control" value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="e.g. 3-7" inputMode="numeric" /></label></div> : null}
          <label className="grid gap-2"><span className="syncvas-label">Source</span><textarea className="syncvas-control min-h-52 font-mono text-sm" value={source} onChange={(event) => setSource(event.target.value)} maxLength={12_000} spellCheck={false} aria-describedby="block-source-help" /><span id="block-source-help" className="syncvas-hint">Maximum 12,000 bytes. Source is retained on the block for editing.</span></label>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={lineNumbers} onChange={(event) => setLineNumbers(event.target.checked)} /> Line numbers</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={diff} onChange={(event) => setDiff(event.target.checked)} /> Diff mode</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={reveal === "step"} onChange={(event) => setReveal(event.target.checked ? "step" : "all")} /> Step reveal</label>
          </div>
          {error ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
          {result?.warnings.map((warning) => <p key={warning} role="status" className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-ink">{warning}</p>)}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="syncvas-btn syncvas-btn-primary" onClick={render}>Render preview</button>
            <button type="button" className="syncvas-btn syncvas-btn-accent" disabled={!result} onClick={insert}>Insert on board</button>
            <button type="button" className="syncvas-btn syncvas-btn-secondary" disabled={!result} onClick={saveSnippet}>Save snippet</button>
            {onHighlight ? <button type="button" className="syncvas-btn syncvas-btn-ghost" disabled={!result} onClick={broadcastPointer}>Point to line</button> : null}
          </div>
          {snippets.length ? <div className="grid gap-2 border-t border-border pt-4"><p className="syncvas-eyebrow">Saved snippets</p>{snippets.slice(0, 6).map((snippet) => <button key={snippet.id} type="button" className="syncvas-btn syncvas-btn-ghost justify-start" onClick={() => loadSnippet(snippet)}><span className="font-mono">/{snippet.grammar}</span><span className="truncate text-ink-muted">{snippet.source.split(/\r?\n/)[0]}</span></button>)}</div> : null}
        </div>
      </Modal>
    </>
  );
}
