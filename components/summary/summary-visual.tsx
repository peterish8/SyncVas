/**
 * Renders one AI-emitted visual as inline SVG/HTML.
 *
 * Charts are drawn from parsed data rather than generated as images: it costs
 * no image API, it stays sharp and theme-aware, and a model that emits a
 * malformed chart degrades to its caption instead of a broken picture.
 */

"use client";

import { parseFlow, parsePlot, parseTable } from "@/lib/summary-visuals";
import type { SummaryResult } from "@/lib/ai/summary-adapter";

type Visual = SummaryResult["visuals"][number];

function PlotChart({ source }: { source: string }) {
  const points = parsePlot(source);
  if (!points) return null;

  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  return (
    <div className="flex flex-col gap-2">
      {points.map((point, index) => (
        <div key={`${point.label}-${index}`} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-xs text-ink-muted" title={point.label}>
            {point.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, (Math.abs(point.value) / max) * 100)}%` }}
            />
          </span>
          <span className="tabular-nums text-xs font-medium text-ink">{point.value}</span>
        </div>
      ))}
    </div>
  );
}

function TableChart({ source }: { source: string }) {
  const table = parseTable(source);
  if (!table) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {table.header.map((cell, index) => (
              <th
                key={index}
                scope="col"
                className="border-b border-border-strong px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-surface-sunken/60">
              {table.header.map((_, colIndex) => (
                <td key={colIndex} className="border-b border-border px-3 py-2 align-top text-ink">
                  {row[colIndex] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowChart({ source }: { source: string }) {
  const graph = parseFlow(source);
  if (!graph) return null;

  return (
    <ol className="flex flex-col gap-0">
      {graph.edges.map((edge, index) => (
        <li key={index} className="flex flex-col gap-0">
          {index === 0 ? (
            <span className="w-fit rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink">
              {edge.from}
            </span>
          ) : null}
          <span className="flex items-center gap-2 py-1 pl-4 text-xs text-ink-subtle">
            <span aria-hidden="true" className="text-base leading-none">
              ↓
            </span>
            {edge.label ? <span className="italic">{edge.label}</span> : null}
          </span>
          <span className="w-fit rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink">
            {edge.to}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SummaryVisual({ visual }: { visual: Visual }) {
  const body =
    visual.grammar === "plot" ? (
      <PlotChart source={visual.source} />
    ) : visual.grammar === "table" ? (
      <TableChart source={visual.source} />
    ) : (
      <FlowChart source={visual.source} />
    );

  // An unparseable visual still carries a caption worth reading.
  if (!body) {
    return visual.caption ? <p className="text-sm text-ink-muted">{visual.caption}</p> : null;
  }

  return (
    <figure className="rounded-panel border border-border bg-surface-muted p-4">
      {body}
      {visual.caption ? (
        <figcaption className="mt-3 text-xs leading-5 text-ink-muted">{visual.caption}</figcaption>
      ) : null}
    </figure>
  );
}
