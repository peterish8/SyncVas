/**
 * Provider-agnostic post-class summary adapter.
 *
 * Feature code and UI must never import a provider SDK — they call
 * getSummaryAdapter() and receive whatever AI_PROVIDER selects. Adding OpenAI
 * later means adding a file under ./providers and one switch case here.
 *
 * Credentials are server-only. Never send student identity, never send the raw
 * board binary payload, never log board text or doubt text.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ input */

export const summaryDoubtSchema = z
  .object({
    text: z.string().max(220),
    voteCount: z.number().int().nonnegative(),
    answered: z.boolean(),
  })
  .strict();

export const summaryInputSchema = z
  .object({
    title: z.string().max(120),
    subject: z.string().max(80).optional(),
    /** Text elements lifted out of the final Excalidraw scene, in reading order. */
    boardText: z.array(z.string().max(600)).max(400),
    /** Compiled block sources already on the board (mermaid/code/math/...). */
    boardBlocks: z
      .array(z.object({ grammar: z.string().max(24), source: z.string().max(2_000) }).strict())
      .max(40),
    doubts: z.array(summaryDoubtSchema).max(60),
    durationMinutes: z.number().int().nonnegative().optional(),
  })
  .strict();

export type SummaryInput = z.infer<typeof summaryInputSchema>;

/* ----------------------------------------------------------------- output */

/**
 * Visual grammars the summary may emit. These compile to real charts through
 * lib/blocks — no image API involved — which is why the summary can show
 * diagrams today while image generation is still unimplemented.
 */
export const SUMMARY_VISUAL_GRAMMARS = ["mermaid", "plot", "table"] as const;
export type SummaryVisualGrammar = (typeof SUMMARY_VISUAL_GRAMMARS)[number];

export const summaryResultSchema = z
  .object({
    title: z.string().max(140),
    overview: z.string().max(1_200),
    topics: z
      .array(
        z.object({
          name: z.string().max(120),
          points: z.array(z.string().max(400)).max(10),
        }).strict(),
      )
      .max(12),
    keyConcepts: z
      .array(
        z.object({
          term: z.string().max(120),
          definition: z.string().max(600),
          /** "clear" = legible on the board, "uncertain" = inferred handwriting. */
          confidence: z.enum(["clear", "uncertain"]),
        }).strict(),
      )
      .max(24),
    /** Charts rendered from block grammars. Compiled, not fabricated images. */
    visuals: z
      .array(
        z.object({
          grammar: z.enum(SUMMARY_VISUAL_GRAMMARS),
          source: z.string().max(2_000),
          caption: z.string().max(240),
        }).strict(),
      )
      .max(8),
    /**
     * Illustration briefs for the future image-generation pass. Emitted now and
     * stored unused so enabling image gen is a rendering change, not a re-run.
     */
    imagePrompts: z
      .array(
        z.object({
          slot: z.string().max(60),
          prompt: z.string().max(600),
          alt: z.string().max(240),
        }).strict(),
      )
      .max(6),
    doubtHighlights: z
      .array(
        z.object({
          question: z.string().max(240),
          answer: z.string().max(600),
        }).strict(),
      )
      .max(12),
    revisionChecklist: z.array(z.string().max(240)).max(16),
    /** Explicit "could not read this" list — omission is preferred to guessing. */
    uncertainNotes: z.array(z.string().max(240)).max(10),
  })
  .strict();

export type SummaryResult = z.infer<typeof summaryResultSchema>;

/* ---------------------------------------------------------------- adapter */

export type SummaryErrorCode =
  | "SUMMARY_PROVIDER_DISABLED"
  | "SUMMARY_PROVIDER_UNAVAILABLE"
  | "SUMMARY_PROVIDER_INVALID_RESULT"
  | "SUMMARY_EMPTY_BOARD";

export class SummaryError extends Error {
  readonly code: SummaryErrorCode;
  constructor(code: SummaryErrorCode, message: string) {
    super(message);
    this.name = "SummaryError";
    this.code = code;
  }
}

export interface SummaryAdapter {
  readonly id: string;
  summarize(input: SummaryInput): Promise<SummaryResult>;
}

/** Default when no provider is configured. End Class must still succeed. */
export class DisabledSummaryAdapter implements SummaryAdapter {
  readonly id = "disabled";
  async summarize(_input: SummaryInput): Promise<SummaryResult> {
    throw new SummaryError("SUMMARY_PROVIDER_DISABLED", "No AI provider is configured.");
  }
}

/** Deterministic offline adapter so the pipeline is testable without a key. */
export class MockSummaryAdapter implements SummaryAdapter {
  readonly id = "mock";
  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const points = input.boardText.filter((line) => line.trim().length > 2).slice(0, 6);
    return {
      title: input.title,
      overview: `Mock summary for ${input.title}. Configure GOOGLE_GENERATIVE_AI_API_KEY for real notes.`,
      topics: points.length ? [{ name: input.subject ?? "Class notes", points }] : [],
      keyConcepts: [],
      visuals: [],
      imagePrompts: [],
      doubtHighlights: input.doubts.slice(0, 3).map((doubt) => ({ question: doubt.text, answer: "" })),
      revisionChecklist: points.slice(0, 4),
      uncertainNotes: [],
    };
  }
}

/* -------------------------------------------------------------- normalize */

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function arr(value: unknown, max: number): unknown[] {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function strList(value: unknown, maxItems: number, maxLen: number): string[] {
  return arr(value, maxItems)
    .map((item) => str(item, maxLen))
    .filter((item) => item.length > 0);
}

/**
 * Shape arbitrary model JSON into the schema before validating.
 *
 * A model that returns one extra key or an over-long list should not lose the
 * student their notes, so trim first and let Zod be the final gate rather than
 * the first one.
 */
export function normalizeSummaryResult(raw: unknown, fallbackTitle: string): SummaryResult {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const grammars = new Set<string>(SUMMARY_VISUAL_GRAMMARS);

  const candidate = {
    title: str(source.title, 140) || fallbackTitle.slice(0, 140),
    overview: str(source.overview, 1_200),
    topics: arr(source.topics, 12)
      .map((topic) => {
        const item = topic && typeof topic === "object" ? (topic as Record<string, unknown>) : {};
        return { name: str(item.name, 120), points: strList(item.points, 10, 400) };
      })
      .filter((topic) => topic.name.length > 0),
    keyConcepts: arr(source.keyConcepts, 24)
      .map((concept) => {
        const item = concept && typeof concept === "object" ? (concept as Record<string, unknown>) : {};
        return {
          term: str(item.term, 120),
          definition: str(item.definition, 600),
          confidence: item.confidence === "uncertain" ? ("uncertain" as const) : ("clear" as const),
        };
      })
      .filter((concept) => concept.term.length > 0 && concept.definition.length > 0),
    visuals: arr(source.visuals, 8)
      .map((visual) => {
        const item = visual && typeof visual === "object" ? (visual as Record<string, unknown>) : {};
        return {
          grammar: str(item.grammar, 24),
          source: str(item.source, 2_000),
          caption: str(item.caption, 240),
        };
      })
      .filter((visual) => grammars.has(visual.grammar) && visual.source.length > 0) as SummaryResult["visuals"],
    imagePrompts: arr(source.imagePrompts, 6)
      .map((image) => {
        const item = image && typeof image === "object" ? (image as Record<string, unknown>) : {};
        return { slot: str(item.slot, 60), prompt: str(item.prompt, 600), alt: str(item.alt, 240) };
      })
      .filter((image) => image.prompt.length > 0),
    doubtHighlights: arr(source.doubtHighlights, 12)
      .map((doubt) => {
        const item = doubt && typeof doubt === "object" ? (doubt as Record<string, unknown>) : {};
        return { question: str(item.question, 240), answer: str(item.answer, 600) };
      })
      .filter((doubt) => doubt.question.length > 0),
    revisionChecklist: strList(source.revisionChecklist, 16, 240),
    uncertainNotes: strList(source.uncertainNotes, 10, 240),
  };

  const parsed = summaryResultSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new SummaryError("SUMMARY_PROVIDER_INVALID_RESULT", "Summary did not match the notes schema.");
  }
  return parsed.data;
}
