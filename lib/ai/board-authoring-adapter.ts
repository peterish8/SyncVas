/**
 * @phase 12
 * Provider-agnostic board authoring adapter — AIB-01, AIB-02, AIB-03.
 *
 * Same shape and same rules as `moderation-adapter.ts`: server-only
 * credentials, never imported by UI or feature code, and every failure mode —
 * unconfigured, timeout, outage, rate limit, malformed result — collapses to
 * the same `unavailable` outcome. Board authoring is never a dependency of
 * classroom reliability.
 *
 * The model returns grammar source and a count of writing zones. It never
 * returns coordinates; positional fields are stripped before anything reaches
 * the layout function.
 */

import { z } from "zod";

/** Grammars a v1.0 draft may contain. `math` is accepted but not yet compiled. */
export const DRAFT_GRAMMARS = ["mermaid", "text", "quiz", "math"] as const;
export type DraftGrammar = (typeof DRAFT_GRAMMARS)[number];

export const MAX_DRAFT_BLOCKS = 24;
export const MAX_DRAFT_SOURCE_CHARS = 4_000;
export const MAX_WRITING_ZONES = 6;

export const boardDraftRequestSchema = z
  .object({
    topic: z.string().min(3).max(300),
    subject: z.string().max(120).optional(),
    detail: z.enum(["light", "standard"]),
    writingZones: z.number().int().min(0).max(MAX_WRITING_ZONES),
  })
  .strict();

/**
 * Deliberately permissive about extra keys on a block: a model that emits
 * `x`/`y`/`width` should have them dropped, not fail the whole draft.
 */
const draftBlockSchema = z
  .object({
    grammar: z.enum(DRAFT_GRAMMARS),
    source: z.string().min(1).max(MAX_DRAFT_SOURCE_CHARS),
    title: z.string().max(200).optional(),
  })
  .transform((block) => ({ grammar: block.grammar, source: block.source, title: block.title }));

export const boardDraftResultSchema = z
  .object({
    status: z.literal("ok"),
    blocks: z.array(draftBlockSchema).max(MAX_DRAFT_BLOCKS),
    writingZones: z.number().int().min(0).max(MAX_WRITING_ZONES),
  })
  .strip();

export type BoardDraftRequest = z.infer<typeof boardDraftRequestSchema>;
export type BoardDraftBlock = { grammar: DraftGrammar; source: string; title?: string };
export type BoardDraftResult =
  | { status: "ok"; blocks: BoardDraftBlock[]; writingZones: number }
  | { status: "unavailable"; reason: DraftUnavailableReason };

export type DraftUnavailableReason =
  | "provider_disabled"
  | "provider_unavailable"
  | "provider_invalid";

export interface BoardAuthoringAdapter {
  draft(req: BoardDraftRequest): Promise<BoardDraftResult>;
}

/** Positional fields are the model's most common overreach. Drop them. */
const POSITIONAL_FIELDS = new Set(["x", "y", "width", "height", "left", "top", "position", "bounds"]);

export function stripPositionalFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPositionalFields);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (POSITIONAL_FIELDS.has(key)) continue;
    result[key] = stripPositionalFields(entry);
  }
  return result;
}

/** The default until a provider is configured. */
export class DisabledBoardAuthoringAdapter implements BoardAuthoringAdapter {
  async draft(_req: BoardDraftRequest): Promise<BoardDraftResult> {
    return { status: "unavailable", reason: "provider_disabled" };
  }
}

const DRAFT_TIMEOUT_MS = 20_000;

class HttpBoardAuthoringAdapter implements BoardAuthoringAdapter {
  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  async draft(req: BoardDraftRequest): Promise<BoardDraftResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DRAFT_TIMEOUT_MS);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!response.ok) return { status: "unavailable", reason: "provider_unavailable" };

      const parsed = boardDraftResultSchema.safeParse(stripPositionalFields(await response.json()));
      if (!parsed.success) return { status: "unavailable", reason: "provider_invalid" };
      return { status: "ok", blocks: parsed.data.blocks, writingZones: parsed.data.writingZones };
    } catch {
      // Timeout, outage and transport failure are one outcome to the caller.
      return { status: "unavailable", reason: "provider_unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getBoardAuthoringAdapter(): BoardAuthoringAdapter {
  const endpoint = process.env.BOARD_AUTHORING_API_URL?.trim();
  const apiKey = process.env.BOARD_AUTHORING_API_KEY?.trim();
  if (endpoint && apiKey) return new HttpBoardAuthoringAdapter(endpoint, apiKey);
  return new DisabledBoardAuthoringAdapter();
}
