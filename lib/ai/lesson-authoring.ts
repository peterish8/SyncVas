/**
 * @phase 12
 * Lesson authoring service — the one path from grammar source to a placed draft.
 *
 * The in-app adapter and (phase 16) the remote MCP tools both call this, so the
 * two can never drift into separate content models. Pure: no network, no
 * Convex, no Excalidraw runtime — it emits element skeletons the caller
 * converts.
 */

import { compileBlock } from "@/lib/blocks/registry";
import { BlockCompileError, type BlockElementSkeleton } from "@/lib/blocks/types";
import {
  boundingBox,
  layoutBoard,
  DEFAULT_CANVAS,
  type BoardLayout,
  type Rect,
  type Size,
} from "@/lib/board/layout";
import type { BoardDraftBlock } from "@/lib/ai/board-authoring-adapter";

/** A question parsed out of a `quiz` block, ready for phase 13 to persist. */
export type DraftQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type DraftBlockOutcome =
  | { grammar: string; status: "placed"; elements: BlockElementSkeleton[]; question?: DraftQuestion }
  | { grammar: string; status: "skipped"; note: string };

export type LessonDraft = {
  elements: BlockElementSkeleton[];
  zones: Rect[];
  canvas: Size;
  questions: DraftQuestion[];
  /** Blocks that could not be compiled, reported by name rather than thrown. */
  skipped: Array<{ grammar: string; note: string }>;
  warnings: string[];
};

const TEXT_FONT_SIZE = 28;
const TEXT_CHAR_WIDTH = TEXT_FONT_SIZE * 0.55;
const TEXT_LINE_HEIGHT = TEXT_FONT_SIZE * 1.35;
const QUIZ_CARD_WIDTH = 420;
const QUIZ_CARD_PADDING = 16;

/**
 * Parses the documented quiz source:
 *
 *   Q: Which activation saturates?
 *   * sigmoid
 *   - relu
 *
 * The asterisk marks the correct option. Throws a stable code the caller reports.
 */
export function parseQuizSource(source: string): DraftQuestion {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const promptLine = lines.find((line) => /^q\s*:/iu.test(line));
  if (!promptLine) throw new Error("QUIZ_PROMPT_MISSING");
  const prompt = promptLine.replace(/^q\s*:/iu, "").trim();
  if (!prompt) throw new Error("QUIZ_PROMPT_MISSING");

  const options: string[] = [];
  let correctIndex = -1;
  for (const line of lines) {
    const match = /^([*-])\s+(.*)$/u.exec(line);
    if (!match) continue;
    const text = match[2].trim();
    if (!text) continue;
    if (match[1] === "*" && correctIndex === -1) {
      // First correct marker wins; a second is ignored rather than fatal.
      correctIndex = options.length;
    }
    options.push(text);
  }

  if (options.length < 2) throw new Error("QUIZ_TOO_FEW_OPTIONS");
  if (correctIndex === -1) throw new Error("QUIZ_NO_CORRECT_OPTION");
  return { prompt, options, correctIndex };
}

function textElements(source: string, title?: string): BlockElementSkeleton[] {
  const text = (title ? `${title}\n${source}` : source).trim();
  const lines = text.split("\n");
  const width = Math.max(...lines.map((line) => line.length)) * TEXT_CHAR_WIDTH;
  return [
    {
      type: "text",
      x: 0,
      y: 0,
      width: Math.max(80, Math.round(width)),
      height: Math.round(lines.length * TEXT_LINE_HEIGHT),
      text,
      fontSize: TEXT_FONT_SIZE,
    },
  ];
}

/**
 * The board carries only an anchor card. The prompt, options and answer key
 * live in Convex and are withheld from students until the question is revealed
 * (docs/35), so nothing here contains the answer.
 */
function quizAnchorElements(index: number): BlockElementSkeleton[] {
  const height = TEXT_LINE_HEIGHT + QUIZ_CARD_PADDING * 2;
  return [
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: QUIZ_CARD_WIDTH,
      height: Math.round(height),
      strokeStyle: "dashed",
    },
    {
      type: "text",
      x: QUIZ_CARD_PADDING,
      y: QUIZ_CARD_PADDING,
      width: QUIZ_CARD_WIDTH - QUIZ_CARD_PADDING * 2,
      height: Math.round(TEXT_LINE_HEIGHT),
      text: `Question ${index + 1}`,
      fontSize: TEXT_FONT_SIZE,
    },
  ];
}

function translate(elements: BlockElementSkeleton[], dx: number, dy: number): BlockElementSkeleton[] {
  return elements.map((element) => ({
    ...element,
    x: (typeof element.x === "number" ? element.x : 0) + dx,
    y: (typeof element.y === "number" ? element.y : 0) + dy,
  }));
}

/** Compiles one draft block to skeletons at the origin, or reports why it could not. */
export function compileDraftBlock(block: BoardDraftBlock, questionIndex: number): DraftBlockOutcome {
  if (block.grammar === "text") {
    return { grammar: "text", status: "placed", elements: textElements(block.source, block.title) };
  }

  if (block.grammar === "quiz") {
    try {
      const question = parseQuizSource(block.source);
      return { grammar: "quiz", status: "placed", elements: quizAnchorElements(questionIndex), question };
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "QUIZ_INVALID";
      return { grammar: "quiz", status: "skipped", note: `Question skipped (${code.toLowerCase()}).` };
    }
  }

  if (block.grammar === "math") {
    // Needs the KaTeX render path; deferred to phase 17 by docs/34.
    return { grammar: "math", status: "skipped", note: "Maths blocks are not supported yet." };
  }

  try {
    const compiled = compileBlock({ grammar: block.grammar, source: block.source, options: { title: block.title } });
    return { grammar: block.grammar, status: "placed", elements: compiled.elements };
  } catch (caught) {
    const note =
      caught instanceof BlockCompileError
        ? `Diagram skipped (${caught.code.toLowerCase()}).`
        : "Diagram skipped (compile failed).";
    return { grammar: block.grammar, status: "skipped", note };
  }
}

/**
 * Turns validated draft blocks into a placed board.
 *
 * One block failing to compile never costs the others their place — docs/34
 * requires the rest to still land with the failure reported by name.
 */
export function buildLessonDraft(
  blocks: BoardDraftBlock[],
  writingZones: number,
  canvas: Size = DEFAULT_CANVAS,
): LessonDraft {
  const compiled: Array<{ id: string; elements: BlockElementSkeleton[] }> = [];
  const questions: DraftQuestion[] = [];
  const skipped: Array<{ grammar: string; note: string }> = [];

  blocks.forEach((block, index) => {
    const outcome = compileDraftBlock(block, questions.length);
    if (outcome.status === "skipped") {
      skipped.push({ grammar: outcome.grammar, note: outcome.note });
      return;
    }
    if (outcome.question) questions.push(outcome.question);
    compiled.push({ id: `block-${index}`, elements: outcome.elements });
  });

  const measured = compiled.map((entry) => {
    const box = boundingBox(entry.elements as Array<Partial<Rect>>);
    return { id: entry.id, width: box.width, height: box.height, box };
  });

  const layout: BoardLayout = layoutBoard(
    measured.map(({ id, width, height }) => ({ id, width, height })),
    writingZones,
    canvas,
  );

  const positionOf = new Map(layout.placed.map((block) => [block.id, block]));
  const elements: BlockElementSkeleton[] = [];
  for (const entry of compiled) {
    const placement = positionOf.get(entry.id);
    const measurement = measured.find((item) => item.id === entry.id);
    if (!placement || !measurement) continue;
    // Normalize each block to its own origin before moving it to its slot.
    elements.push(
      ...translate(entry.elements, placement.x - measurement.box.x, placement.y - measurement.box.y),
    );
  }

  return {
    elements,
    zones: layout.zones,
    canvas: layout.canvas,
    questions,
    skipped,
    warnings: skipped.map((entry) => entry.note),
  };
}
