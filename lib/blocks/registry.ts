import type { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types";
import { BLOCK_GRAMMARS, BLOCK_LIMITS, BlockCompileError, type BlockCompileRequest, type BlockCompileResult, type BlockElementSkeleton, type BlockGrammarId, type BlockOptions, type BlockTheme } from "./types";

const themes: BlockTheme[] = ["one-dark-pro", "github-light", "github-dark", "nord", "catppuccin-latte", "monokai"];
const colors: Record<string, { bg: string; fg: string; muted: string; accent: string }> = {
  "one-dark-pro": { bg: "#282c34", fg: "#abb2bf", muted: "#5c6370", accent: "#61afef" },
  "github-light": { bg: "#ffffff", fg: "#24292f", muted: "#6e7781", accent: "#0969da" },
  "github-dark": { bg: "#0d1117", fg: "#c9d1d9", muted: "#8b949e", accent: "#58a6ff" },
  nord: { bg: "#2e3440", fg: "#d8dee9", muted: "#81a1c1", accent: "#88c0d0" },
  "catppuccin-latte": { bg: "#eff1f5", fg: "#4c4f69", muted: "#8c8fa1", accent: "#1e66f5" },
  monokai: { bg: "#272822", fg: "#f8f8f2", muted: "#a6a6a0", accent: "#a6e22e" },
};

type AnySkeleton = BlockElementSkeleton & { customData?: Record<string, unknown> };
type Point = [number, number];

function safeTheme(value: BlockOptions["theme"]): BlockTheme {
  if (typeof value === "string" && themes.includes(value as BlockTheme)) return value as BlockTheme;
  return value === "dark" ? "github-dark" : "github-light";
}

function text(x: number, y: number, value: string, customData: Record<string, unknown>, size = 20, color = "#171717"): AnySkeleton {
  return { type: "text", x, y, text: value.slice(0, 400), fontSize: size, strokeColor: color, customData } as AnySkeleton;
}
function rect(x: number, y: number, width: number, height: number, customData: Record<string, unknown>, backgroundColor = "#ffffff"): AnySkeleton {
  return { type: "rectangle", x, y, width, height, backgroundColor, fillStyle: "solid", strokeColor: "#7b7b73", roundness: { type: 3 }, customData } as AnySkeleton;
}
function ellipse(x: number, y: number, width: number, height: number, customData: Record<string, unknown>, backgroundColor = "#ffffff"): AnySkeleton {
  return { type: "ellipse", x, y, width, height, backgroundColor, fillStyle: "solid", strokeColor: "#7b7b73", customData } as AnySkeleton;
}
function line(x: number, y: number, points: Point[], customData: Record<string, unknown>, arrow = false): AnySkeleton {
  return { type: arrow ? "arrow" : "line", x, y, points, strokeColor: "#5f625d", strokeWidth: 2, customData } as AnySkeleton;
}
function attach(items: AnySkeleton[], meta: Record<string, unknown>): AnySkeleton[] {
  return items.map((item, index) => ({ ...item, customData: { sv: meta, revealIndex: index } }));
}
function lines(source: string): string[] { return source.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 120); }
function svgData(svg: string): string { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
function escapeXml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char); }

function imageBlock(source: string, grammar: BlockGrammarId, opts: BlockOptions, meta: Record<string, unknown>): { elements: AnySkeleton[]; files: BinaryFiles } {
  const theme = safeTheme(opts.theme);
  const palette = colors[theme];
  const title = opts.title ?? `/${grammar}`;
  const sourceLines = source.split(/\r?\n/).slice(0, 42);
  const lineHeight = 25;
  const height = Math.max(180, 76 + sourceLines.length * lineHeight);
  const focusMatch = typeof opts.focus === "string" ? opts.focus.match(/^(\d+)(?:-(\d+))?$/) : null;
  const focusStart = focusMatch ? Number(focusMatch[1]) : null;
  const focusEnd = focusMatch ? Number(focusMatch[2] ?? focusMatch[1]) : null;
  const code = sourceLines.map((value, index) => {
    const lineNumber = index + 1;
    const opacity = focusStart !== null && focusEnd !== null && (lineNumber < focusStart || lineNumber > focusEnd) ? "0.36" : "1";
    const diffFill = opts.diff && value.startsWith("+") ? "#98c379" : opts.diff && value.startsWith("-") ? "#e06c75" : palette.fg;
    return `<text x="30" y="${64 + index * lineHeight}" fill="${diffFill}" opacity="${opacity}" font-family="monospace" font-size="16"><tspan fill="${palette.muted}">${String(lineNumber).padStart(2, "0")} </tspan>${escapeXml(value || " ")}</text>`;
  }).join("");
  const language = opts.language ? ` · ${opts.language}` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${height}" viewBox="0 0 760 ${height}"><rect width="760" height="${height}" rx="18" fill="${palette.bg}"/><text x="30" y="34" fill="${palette.accent}" font-family="monospace" font-size="13">${escapeXml(title + language)}</text>${code}</svg>`;
  const fileId = `sv-${grammar}-${Math.random().toString(36).slice(2, 10)}`;
  const file = { id: fileId, mimeType: "image/svg+xml", dataURL: svgData(svg), created: Date.now() } as unknown as BinaryFileData;
  return { elements: [{ type: "image", x: 120, y: 120, width: 760, height, fileId, customData: { sv: meta } } as AnySkeleton], files: { [fileId]: file } };
}

function compileNative(grammar: BlockGrammarId, source: string, opts: BlockOptions, meta: Record<string, unknown>): { elements: AnySkeleton[]; files: BinaryFiles; warnings: string[] } {
  const out: AnySkeleton[] = [];
  const sourceLines = lines(source);
  const warnings: string[] = [];
  if (["code", "math"].includes(grammar)) {
    const result = imageBlock(source, grammar, opts, meta);
    return { ...result, warnings };
  }
  if (grammar === "mermaid") {
    const supported = /(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram)/i.test(source);
    if (!supported) {
      warnings.push("This Mermaid type uses an SVG fallback so it remains visible and synced.");
      const result = imageBlock(source, grammar, opts, meta);
      return { ...result, warnings };
    }
    sourceLines.slice(1).forEach((value, index) => {
      const parts = value.split(/-->|->|--|:/).map((part) => part.trim()).filter(Boolean);
      const label = parts[0] ?? value;
      out.push(rect(120 + (index % 3) * 240, 140 + Math.floor(index / 3) * 120, 190, 64, meta, "#f4fcb8"));
      out.push(text(136 + (index % 3) * 240, 162 + Math.floor(index / 3) * 120, label, meta, 16));
      if (index > 0) out.push(line(215 + ((index - 1) % 3) * 240, 204 + Math.floor((index - 1) / 3) * 120, [[0, 0], [45, 0]], meta, true));
      if (parts[1]) out.push(text(130 + (index % 3) * 240, 230 + Math.floor(index / 3) * 120, parts[1], meta, 13, "#6f6d66"));
    });
  } else if (grammar === "ds") {
    const values = source.replace(/^\w+\s*/i, "").match(/-?\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9_]*/g) ?? sourceLines;
    values.slice(0, 20).forEach((value, index) => { out.push(rect(100 + index * 100, 160, 82, 58, meta, index % 2 ? "#eef7d0" : "#ffffff")); out.push(text(118 + index * 100, 194, value, meta, 18)); if (index) out.push(line(182 + (index - 1) * 100, 189, [[0, 0], [18, 0]], meta, true)); });
  } else if (grammar === "calltree") {
    const root = source.match(/([A-Za-z_][\w]*)\((\d+)\)/)?.[0] ?? sourceLines[0] ?? "call()";
    out.push(ellipse(380, 110, 180, 58, meta, "#f4fcb8")); out.push(text(402, 145, root, meta, 18));
    ["left", "right"].forEach((branch, index) => { const x = 220 + index * 320; out.push(ellipse(x, 260, 180, 58, meta, index ? "#e8f5e9" : "#fff6e3")); out.push(text(x + 24, 295, `${root} · ${branch}`, meta, 15)); out.push(line(470, 168, [[0, 0], [x + 90 - 470, 92]], meta, true)); });
  } else if (grammar === "plot") {
    out.push(line(120, 460, [[0, 0], [700, 0]], meta)); out.push(line(160, 500, [[0, 0], [0, -350]], meta)); out.push(text(760, 466, "x", meta, 16)); out.push(text(134, 130, "y", meta, 16));
    for (let index = 0; index < 10; index += 1) { const x = index * 65; const y = Math.sin(index / 2) * 80; out.push(line(160 + x, 460 - y, [[0, 0], [65, Math.sin((index + 1) / 2) * -80 + y]], meta)); }
    out.push(text(190, 110, sourceLines[0] ?? "complexity growth", meta, 20));
  } else if (grammar === "tensor") {
    sourceLines.forEach((value, index) => { const x = 100 + index * 210; out.push(rect(x, 180, 170, 80, meta, "#e8f5e9")); out.push(text(x + 14, 214, value.slice(0, 24), meta, 15)); if (index) out.push(line(x - 40, 220, [[0, 0], [40, 0]], meta, true)); });
  } else if (grammar === "nn") {
    sourceLines.filter((value) => !value.startsWith("#")).slice(0, 10).forEach((value, index) => { const x = 120 + (index % 2) * 300; const y = 100 + Math.floor(index / 2) * 120; out.push(rect(x, y, 240, 74, meta, index % 2 ? "#f4fcb8" : "#e8f5e9")); out.push(text(x + 16, y + 31, value, meta, 15)); if (index % 2) out.push(line(x - 60, y + 37, [[0, 0], [60, 0]], meta, true)); });
  } else if (["dp", "trace", "table", "matrix", "confusion", "truth", "kmap"].includes(grammar)) {
    const rows = sourceLines.slice(0, 12).map((value) => value.split(/[,|\t]+/).slice(0, 8));
    const width = Math.max(2, ...rows.map((row) => row.length));
    rows.forEach((row, rowIndex) => { for (let column = 0; column < width; column += 1) { const value = row[column] ?? ""; const x = 100 + column * 120; const y = 100 + rowIndex * 54; out.push(rect(x, y, 112, 48, meta, rowIndex === 0 ? "#f4fcb8" : "#ffffff")); if (value) out.push(text(x + 10, y + 29, value, meta, 14)); } });
  } else if (["dfa", "nfa", "tm"].includes(grammar)) {
    const states = [...new Set(source.match(/\bq\w+\b/gi) ?? ["q0", "q1", "q2"])].slice(0, 8);
    states.forEach((state, index) => { const x = 120 + (index % 4) * 190; const y = 160 + Math.floor(index / 4) * 150; out.push(ellipse(x, y, 110, 62, meta, index === 0 ? "#f4fcb8" : "#ffffff")); out.push(text(x + 28, y + 36, state, meta, 18)); if (index) out.push(line(x - 80, y + 30, [[0, 0], [80, 0]], meta, true)); });
  } else if (grammar === "mem") {
    ["stack", "heap"].forEach((label, index) => { const x = 120 + index * 300; out.push(rect(x, 130, 220, 300, meta, index ? "#e8f5e9" : "#fff6e3")); out.push(text(x + 20, 165, label, meta, 20)); sourceLines.slice(0, 5).forEach((value, row) => { out.push(rect(x + 20, 190 + row * 44, 180, 34, meta, "#ffffff")); out.push(text(x + 30, 213 + row * 44, value, meta, 13)); }); });
  } else if (grammar === "bits") {
    const bits = source.match(/[01]/g) ?? "01010101".split(""); bits.slice(0, 32).forEach((bit, index) => { const x = 100 + index * 24; out.push(rect(x, 180, 22, 54, meta, index < 8 ? "#f4fcb8" : "#ffffff")); out.push(text(x + 7, 214, bit, meta, 14)); }); out.push(text(100, 150, "bit field", meta, 20));
  } else if (grammar === "circuit") {
    out.push(ellipse(160, 180, 120, 70, meta, "#f4fcb8")); out.push(text(198, 222, "AND", meta, 18)); out.push(ellipse(460, 180, 120, 70, meta, "#e8f5e9")); out.push(text(497, 222, "OR", meta, 18)); out.push(line(280, 215, [[0, 0], [180, 0]], meta, true)); out.push(text(180, 150, sourceLines[0] ?? "logic", meta, 18));
  } else if (grammar === "sched") {
    sourceLines.slice(0, 8).forEach((value, index) => { out.push(rect(120 + index * 100, 180, 96, 58, meta, index % 2 ? "#e8f5e9" : "#fff6e3")); out.push(text(132 + index * 100, 214, value.slice(0, 12), meta, 13)); }); out.push(text(120, 150, "timeline", meta, 20));
  } else {
    sourceLines.forEach((value, index) => { out.push(rect(120, 120 + index * 90, 620, 62, meta, "#ffffff")); out.push(text(140, 157 + index * 90, value, meta, 16)); });
  }
  return { elements: attach(out, meta), files: {}, warnings };
}

export function compileBlock(request: BlockCompileRequest): BlockCompileResult {
  const grammar = String(request.grammar).replace(/^\//, "") as BlockGrammarId;
  if (!BLOCK_GRAMMARS.includes(grammar)) throw new BlockCompileError("UNKNOWN_GRAMMAR", `Unsupported grammar: /${grammar}`);
  const source = request.source.trim();
  if (!source) throw new BlockCompileError("INVALID_SOURCE", "Enter a source block before rendering.");
  const sourceBytes = new TextEncoder().encode(source).byteLength;
  if (sourceBytes > BLOCK_LIMITS.sourceBytes) throw new BlockCompileError("SOURCE_TOO_LARGE", `Source is limited to ${BLOCK_LIMITS.sourceBytes.toLocaleString()} bytes.`);
  const options = { theme: safeTheme(request.options?.theme), reveal: request.options?.reveal ?? "all", step: request.options?.step ?? 0, ...request.options } as BlockCompileResult["options"];
  const meta = { grammar, source, opts: options };
  const compiled = compileNative(grammar, source, options, meta);
  if (compiled.elements.length > BLOCK_LIMITS.elements) throw new BlockCompileError("ELEMENT_LIMIT", `This block would create more than ${BLOCK_LIMITS.elements} elements.`);
  const sceneBytes = new TextEncoder().encode(JSON.stringify(compiled.elements)).byteLength;
  const filesBytes = new TextEncoder().encode(JSON.stringify(compiled.files)).byteLength;
  if (sceneBytes > BLOCK_LIMITS.sceneBytes || filesBytes > BLOCK_LIMITS.filesBytes) throw new BlockCompileError("SCENE_TOO_LARGE", "This block is too large for a live board. Shorten the source and try again.");
  return { grammar, source, options, elements: compiled.elements, files: compiled.files, warnings: compiled.warnings };
}

export function listBlockGrammars(): readonly BlockGrammarId[] { return BLOCK_GRAMMARS; }
