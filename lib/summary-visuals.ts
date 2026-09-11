/**
 * Parsers for the three visual grammars the summary may emit.
 *
 * The notes page renders these as inline SVG/HTML rather than reusing the board
 * block compiler, because that compiler emits Excalidraw element skeletons —
 * the right output for a canvas, the wrong one for a document. Parsing stays
 * here so the components render already-validated data.
 *
 * Every parser is total: malformed model output yields null and the caller
 * falls back to showing the caption alone. A bad chart must not blank the page.
 */

export type PlotPoint = { label: string; value: number };
export type TableData = { header: string[]; rows: string[][] };
export type FlowEdge = { from: string; to: string; label?: string };
export type FlowGraph = { nodes: string[]; edges: FlowEdge[] };

const MAX_ROWS = 24;
const MAX_COLS = 8;
const MAX_NODES = 24;

function lines(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** "label value" or "label: value", one pair per line. */
export function parsePlot(source: string): PlotPoint[] | null {
  const points: PlotPoint[] = [];
  for (const line of lines(source).slice(0, MAX_ROWS)) {
    const match = line.match(/^(.*?)[\s:]+(-?\d+(?:\.\d+)?)$/u);
    if (!match) continue;
    const label = match[1].trim().replace(/[|,]$/u, "").slice(0, 40);
    const value = Number(match[2]);
    if (!label || !Number.isFinite(value)) continue;
    points.push({ label, value });
  }
  return points.length >= 2 ? points : null;
}

/** Pipe-separated rows, header first. A `---` separator row is ignored. */
export function parseTable(source: string): TableData | null {
  const rows = lines(source)
    .map((line) => line.replace(/^\||\|$/gu, ""))
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|").map((cell) => cell.trim().slice(0, 120)).slice(0, MAX_COLS))
    .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/u.test(cell)));

  if (rows.length < 2) return null;
  const [header, ...body] = rows;
  if (header.every((cell) => cell.length === 0)) return null;
  return { header, rows: body.slice(0, MAX_ROWS) };
}

/**
 * A deliberately small Mermaid subset: `A --> B`, `A -->|label| B`, and
 * bracketed display names. Anything richer is treated as unparseable rather
 * than half-rendered.
 */
export function parseFlow(source: string): FlowGraph | null {
  const labels = new Map<string, string>();
  const edges: FlowEdge[] = [];

  const readNode = (raw: string): string | null => {
    const token = raw.trim();
    if (!token) return null;
    const match = token.match(/^([A-Za-z0-9_.-]+)\s*(?:[[({]{1,2}\s*"?([^"\])}]*)"?\s*[\])}]{1,2})?$/u);
    if (!match) return null;
    const id = match[1];
    const display = (match[2] ?? "").trim();
    if (display) labels.set(id, display.slice(0, 60));
    else if (!labels.has(id)) labels.set(id, id.slice(0, 60));
    return id;
  };

  for (const line of lines(source)) {
    if (/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram)/iu.test(line)) continue;
    const match = line.match(/^(.+?)\s*-{2,}>\s*(?:\|([^|]*)\|\s*)?(.+?)$/u);
    if (!match) continue;
    const from = readNode(match[1]);
    const to = readNode(match[3]);
    if (!from || !to) continue;
    const label = match[2]?.trim().slice(0, 40) || undefined;
    edges.push({ from, to, label });
    if (edges.length >= MAX_NODES) break;
  }

  if (edges.length === 0) return null;

  const nodes: string[] = [];
  for (const edge of edges) {
    for (const id of [edge.from, edge.to]) {
      if (!nodes.includes(id)) nodes.push(id);
    }
  }
  return {
    nodes: nodes.slice(0, MAX_NODES).map((id) => labels.get(id) ?? id),
    edges: edges.map((edge) => ({
      from: labels.get(edge.from) ?? edge.from,
      to: labels.get(edge.to) ?? edge.to,
      label: edge.label,
    })),
  };
}
