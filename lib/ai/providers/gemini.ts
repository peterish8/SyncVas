/**
 * Gemini implementation of SummaryAdapter (REST, no SDK dependency).
 *
 * Uses structured output (responseMimeType + responseSchema) so the model
 * returns the notes shape directly instead of prose we would have to parse.
 * Nothing here is imported by feature code — go through getSummaryAdapter().
 */

import {
  SUMMARY_VISUAL_GRAMMARS,
  SummaryError,
  normalizeSummaryResult,
  type SummaryAdapter,
  type SummaryInput,
  type SummaryResult,
} from "../summary-adapter";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 45_000;
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini accepts an OpenAPI subset; keep it flat and let Zod do real enforcement. */
const responseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    overview: { type: "STRING" },
    topics: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          points: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["name", "points"],
      },
    },
    keyConcepts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          term: { type: "STRING" },
          definition: { type: "STRING" },
          confidence: { type: "STRING", enum: ["clear", "uncertain"] },
        },
        required: ["term", "definition", "confidence"],
      },
    },
    visuals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          grammar: { type: "STRING", enum: [...SUMMARY_VISUAL_GRAMMARS] },
          source: { type: "STRING" },
          caption: { type: "STRING" },
        },
        required: ["grammar", "source", "caption"],
      },
    },
    imagePrompts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          slot: { type: "STRING" },
          prompt: { type: "STRING" },
          alt: { type: "STRING" },
        },
        required: ["slot", "prompt", "alt"],
      },
    },
    doubtHighlights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          answer: { type: "STRING" },
        },
        required: ["question", "answer"],
      },
    },
    revisionChecklist: { type: "ARRAY", items: { type: "STRING" } },
    uncertainNotes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "title",
    "overview",
    "topics",
    "keyConcepts",
    "visuals",
    "imagePrompts",
    "doubtHighlights",
    "revisionChecklist",
    "uncertainNotes",
  ],
} as const;

const SYSTEM_INSTRUCTION = [
  "You turn a finished classroom whiteboard into revision notes for the students who attended.",
  "",
  "Grounding rules — these override helpfulness:",
  "- Use ONLY the board text, board blocks, and doubts provided. Never introduce outside facts.",
  "- Never invent an equation, definition, number, or claim that is not present in the input.",
  "- Board text comes from handwriting-adjacent sources and may be garbled. If a fragment is",
  "  not confidently readable, either omit it or mark the concept confidence as uncertain",
  "  and add a line to uncertainNotes. Prefer omission over guessing.",
  "- If the board is nearly empty, return short honest output rather than padding it.",
  "",
  "Visuals: emit a diagram only when the board actually contained that structure.",
  "mermaid source must be valid Mermaid (flowchart, sequence, class or state).",
  "plot is one label-then-value pair per line. table is pipe-separated rows, header first.",
  "Do not emit a visual just to have one.",
  "",
  "imagePrompts describe illustrations that WOULD help; they are stored for a later",
  "image-generation pass and are not rendered now. Keep them concrete and classroom-safe.",
  "",
  "Write plainly, in the language the board is written in. Students read these to revise.",
].join("\n");

function buildPrompt(input: SummaryInput): string {
  const parts: string[] = [
    `Class title: ${input.title}`,
    input.subject ? `Subject: ${input.subject}` : null,
    input.durationMinutes ? `Duration: ${input.durationMinutes} minutes` : null,
    "",
    "=== BOARD TEXT (reading order) ===",
    input.boardText.length
      ? input.boardText.map((line, index) => `${index + 1}. ${line}`).join("\n")
      : "(no text elements on the board)",
  ].filter((value): value is string => value !== null);

  if (input.boardBlocks.length) {
    parts.push(
      "",
      "=== BOARD BLOCKS (already-structured content the teacher placed) ===",
      input.boardBlocks.map((block) => `[${block.grammar}]\n${block.source}`).join("\n\n"),
    );
  }

  if (input.doubts.length) {
    parts.push(
      "",
      "=== CLASS DOUBTS (anonymous, most-voted first) ===",
      input.doubts
        .map((doubt) => `- (${doubt.voteCount} votes${doubt.answered ? ", answered in class" : ""}) ${doubt.text}`)
        .join("\n"),
    );
  }

  parts.push("", "Produce the revision notes JSON now.");
  return parts.join("\n");
}

function extractText(payload: unknown): string | null {
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts;
  if (!Array.isArray(parts)) return null;
  const joined = parts
    .map((part) => (typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
    .join("");
  return joined.trim() || null;
}

export class GeminiSummaryAdapter implements SummaryAdapter {
  readonly id = "gemini";

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${API_ROOT}/${this.model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.2,
            maxOutputTokens: 8_192,
          },
        }),
      });
    } catch {
      // Network failure and timeout read the same to the caller.
      throw new SummaryError("SUMMARY_PROVIDER_UNAVAILABLE", "The summary provider did not respond.");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Status only — a provider error body can echo the prompt back into logs.
      throw new SummaryError("SUMMARY_PROVIDER_UNAVAILABLE", `Summary provider returned ${response.status}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SummaryError("SUMMARY_PROVIDER_INVALID_RESULT", "Summary provider returned malformed JSON.");
    }

    const text = extractText(payload);
    if (!text) throw new SummaryError("SUMMARY_PROVIDER_INVALID_RESULT", "Summary provider returned no content.");

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new SummaryError("SUMMARY_PROVIDER_INVALID_RESULT", "Summary provider returned non-JSON content.");
    }

    return normalizeSummaryResult(raw, input.title);
  }
}
