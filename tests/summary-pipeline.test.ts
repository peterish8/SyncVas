import { describe, expect, it } from "vitest";

import {
  MockSummaryAdapter,
  normalizeSummaryResult,
  summaryInputSchema,
  summaryResultSchema,
} from "@/lib/ai/summary-adapter";
import { getSummaryAdapter } from "@/lib/ai/summary";
import { extractBoardContent, hasSummarizableContent } from "@/lib/summary-input";
import { parseFlow, parsePlot, parseTable } from "@/lib/summary-visuals";

function scene(elements: unknown[]): string {
  return JSON.stringify({ type: "excalidraw", elements, appState: {} });
}

describe("provider selection", () => {
  it("defaults to mock when AI_PROVIDER is unset", () => {
    expect(getSummaryAdapter({}).id).toBe("mock");
  });

  it("falls back to disabled when gemini is selected without a key", () => {
    expect(getSummaryAdapter({ AI_PROVIDER: "gemini" }).id).toBe("disabled");
  });

  it("selects gemini once a key is present", () => {
    expect(getSummaryAdapter({ AI_PROVIDER: "gemini", GOOGLE_GENERATIVE_AI_API_KEY: "k" }).id).toBe("gemini");
  });

  it("does not silently fall back to a live provider for an unimplemented one", () => {
    expect(getSummaryAdapter({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" }).id).toBe("disabled");
  });
});

describe("board extraction", () => {
  it("orders text top-to-bottom then left-to-right", () => {
    const extract = extractBoardContent(
      scene([
        { type: "text", text: "second", x: 10, y: 200 },
        { type: "text", text: "first-right", x: 300, y: 10 },
        { type: "text", text: "first-left", x: 10, y: 12 },
      ]),
    );
    expect(extract.boardText).toEqual(["first-left", "first-right", "second"]);
  });

  it("skips deleted elements and reports block sources separately", () => {
    const extract = extractBoardContent(
      scene([
        { type: "text", text: "gone", x: 0, y: 0, isDeleted: true },
        { type: "text", text: "kept", x: 0, y: 10 },
        { type: "text", text: "block label", x: 0, y: 20, customData: { sv: { grammar: "mermaid", source: "A --> B" } } },
      ]),
    );
    expect(extract.boardText).toEqual(["kept"]);
    expect(extract.boardBlocks).toEqual([{ grammar: "mermaid", source: "A --> B" }]);
  });

  it("survives malformed scene JSON", () => {
    expect(extractBoardContent("not json")).toEqual({ boardText: [], boardBlocks: [] });
  });

  it("treats a nearly empty board as not summarizable", () => {
    expect(hasSummarizableContent({ boardText: ["hi"], boardBlocks: [] })).toBe(false);
    expect(hasSummarizableContent({ boardText: [], boardBlocks: [{ grammar: "plot", source: "a 1" }] })).toBe(true);
  });
});

describe("result normalization", () => {
  it("trims over-long output instead of rejecting it", () => {
    const notes = normalizeSummaryResult(
      {
        title: "T",
        overview: "o",
        topics: Array.from({ length: 40 }, (_, i) => ({ name: `t${i}`, points: ["p"] })),
        keyConcepts: [],
        visuals: [],
        imagePrompts: [],
        doubtHighlights: [],
        revisionChecklist: [],
        uncertainNotes: [],
        surprise: "extra key",
      },
      "fallback",
    );
    expect(notes.topics).toHaveLength(12);
    expect(summaryResultSchema.safeParse(notes).success).toBe(true);
  });

  it("drops visuals whose grammar is not renderable", () => {
    const notes = normalizeSummaryResult(
      {
        title: "T",
        overview: "",
        topics: [],
        keyConcepts: [],
        visuals: [
          { grammar: "plot", source: "a 1", caption: "c" },
          { grammar: "tensor", source: "x", caption: "c" },
        ],
        imagePrompts: [],
        doubtHighlights: [],
        revisionChecklist: [],
        uncertainNotes: [],
      },
      "fallback",
    );
    expect(notes.visuals.map((visual) => visual.grammar)).toEqual(["plot"]);
  });

  it("uses the session title when the model omits one", () => {
    const notes = normalizeSummaryResult({ overview: "o" }, "Algebra recap");
    expect(notes.title).toBe("Algebra recap");
  });
});

describe("mock adapter round-trip", () => {
  it("produces output that satisfies the stored schema", async () => {
    const input = summaryInputSchema.parse({
      title: "Sorting algorithms",
      boardText: ["Merge sort divides the array", "Time complexity n log n"],
      boardBlocks: [],
      doubts: [{ text: "why n log n?", voteCount: 3, answered: false }],
    });
    const notes = await new MockSummaryAdapter().summarize(input);
    expect(summaryResultSchema.safeParse(notes).success).toBe(true);
  });
});

describe("visual parsers", () => {
  it("parses plot pairs and rejects a single point", () => {
    expect(parsePlot("Merge 24\nQuick: 18\nBubble 4")).toEqual([
      { label: "Merge", value: 24 },
      { label: "Quick", value: 18 },
      { label: "Bubble", value: 4 },
    ]);
    expect(parsePlot("only 1")).toBeNull();
  });

  it("parses a pipe table and drops the markdown separator row", () => {
    const table = parseTable("| Algo | Time |\n| --- | --- |\n| Merge | n log n |");
    expect(table).toEqual({ header: ["Algo", "Time"], rows: [["Merge", "n log n"]] });
  });

  it("parses a mermaid flowchart subset with labels", () => {
    const graph = parseFlow("flowchart TD\n A[Split] --> B[Sort]\n B -->|merge| C[Done]");
    expect(graph?.nodes).toEqual(["Split", "Sort", "Done"]);
    expect(graph?.edges[1]).toEqual({ from: "Sort", to: "Done", label: "merge" });
  });

  it("returns null rather than half-rendering unsupported syntax", () => {
    expect(parseFlow("sequenceDiagram\n Alice->>John: Hello")).toBeNull();
    expect(parseTable("no pipes here")).toBeNull();
  });
});
