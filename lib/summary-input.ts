/**
 * Turns a persisted final Excalidraw scene into the compact text the summary
 * adapter receives.
 *
 * The model never sees the raw scene: it is mostly geometry, it blows past any
 * sane token budget, and it carries binary file payloads. Extract the parts a
 * reader would actually read, in the order they would read them.
 */

import type { SummaryInput } from "./ai/summary-adapter";

type SceneElement = {
  type?: unknown;
  text?: unknown;
  x?: unknown;
  y?: unknown;
  isDeleted?: unknown;
  customData?: unknown;
};

const MAX_TEXT_ELEMENTS = 400;
const MAX_BLOCKS = 40;
const MAX_TEXT_LEN = 600;
const MAX_BLOCK_SOURCE_LEN = 2_000;
/** Rows within this many pixels count as the same line for reading order. */
const ROW_BAND_PX = 24;

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export type BoardExtract = Pick<SummaryInput, "boardText" | "boardBlocks">;

export function extractBoardContent(sceneJson: string): BoardExtract {
  let elements: SceneElement[];
  try {
    const parsed = JSON.parse(sceneJson) as { elements?: unknown };
    elements = Array.isArray(parsed.elements) ? (parsed.elements as SceneElement[]) : [];
  } catch {
    return { boardText: [], boardBlocks: [] };
  }

  const live = elements.filter((element) => element?.isDeleted !== true);

  // Block sources are already structured, so they are reported separately and
  // their rendered text is not repeated into boardText.
  const blocks: BoardExtract["boardBlocks"] = [];
  const seenBlocks = new Set<string>();
  for (const element of live) {
    const custom = element.customData;
    const sv = custom && typeof custom === "object" ? (custom as { sv?: unknown }).sv : undefined;
    if (!sv || typeof sv !== "object") continue;
    const meta = sv as { grammar?: unknown; source?: unknown };
    if (typeof meta.grammar !== "string" || typeof meta.source !== "string") continue;
    const key = `${meta.grammar}:${meta.source}`;
    if (seenBlocks.has(key)) continue;
    seenBlocks.add(key);
    if (blocks.length < MAX_BLOCKS) {
      blocks.push({ grammar: meta.grammar.slice(0, 24), source: meta.source.slice(0, MAX_BLOCK_SOURCE_LEN) });
    }
  }

  const texts = live
    .filter((element) => element.type === "text" && typeof element.text === "string")
    .filter((element) => {
      const custom = element.customData;
      const sv = custom && typeof custom === "object" ? (custom as { sv?: unknown }).sv : undefined;
      return !sv; // block-rendered text is covered by boardBlocks
    })
    .map((element) => ({ x: num(element.x), y: num(element.y), text: (element.text as string).trim() }))
    .filter((element) => element.text.length > 0)
    // Top-to-bottom, then left-to-right within a row band. Excalidraw stores no
    // ordering of its own, so this approximates how the class read the board.
    .sort((a, b) => (Math.abs(a.y - b.y) <= ROW_BAND_PX ? a.x - b.x : a.y - b.y))
    .map((element) => element.text.slice(0, MAX_TEXT_LEN))
    .slice(0, MAX_TEXT_ELEMENTS);

  return { boardText: texts, boardBlocks: blocks };
}

/** A board with nothing readable produces no notes worth showing. */
export function hasSummarizableContent(extract: BoardExtract): boolean {
  const textChars = extract.boardText.join("").replace(/\s/gu, "").length;
  return textChars >= 24 || extract.boardBlocks.length > 0;
}
