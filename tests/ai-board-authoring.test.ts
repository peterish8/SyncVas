/**
 * @phase 12
 * AI board authoring — AIB-01..04.
 *
 * The test that matters most is AIB-04: for any generated board, no element's
 * bounding box may intersect a reserved writing zone.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DisabledBoardAuthoringAdapter,
  boardDraftRequestSchema,
  boardDraftResultSchema,
  getBoardAuthoringAdapter,
  stripPositionalFields,
  type BoardDraftBlock,
} from "@/lib/ai/board-authoring-adapter";
import { buildLessonDraft, parseQuizSource } from "@/lib/ai/lesson-authoring";
import { boundingBox, intersects, layoutBoard, type LayoutBlock, type Rect } from "@/lib/board/layout";

const originalFetch = globalThis.fetch;
const originalEnv = {
  url: process.env.BOARD_AUTHORING_API_URL,
  key: process.env.BOARD_AUTHORING_API_KEY,
};

beforeEach(() => {
  delete process.env.BOARD_AUTHORING_API_URL;
  delete process.env.BOARD_AUTHORING_API_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnv.url === undefined) delete process.env.BOARD_AUTHORING_API_URL;
  else process.env.BOARD_AUTHORING_API_URL = originalEnv.url;
  if (originalEnv.key === undefined) delete process.env.BOARD_AUTHORING_API_KEY;
  else process.env.BOARD_AUTHORING_API_KEY = originalEnv.key;
});

/** Deterministic pseudo-random source so a failure is reproducible. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("AIB-04 reserved writing zones stay empty", () => {
  it("places nothing inside a reserved zone across many generated boards", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = seeded(seed);
      const blockCount = Math.floor(random() * 12);
      const zones = Math.floor(random() * 5);
      const blocks: LayoutBlock[] = Array.from({ length: blockCount }, (_, index) => ({
        id: `b${index}`,
        width: 40 + Math.floor(random() * 900),
        height: 40 + Math.floor(random() * 400),
      }));

      const layout = layoutBoard(blocks, zones, { width: 1600, height: 900 });

      expect(layout.zones).toHaveLength(zones);
      for (const zone of layout.zones) {
        for (const placed of layout.placed) {
          const box: Rect = { x: placed.x, y: placed.y, width: placed.width, height: placed.height };
          expect(
            intersects(box, zone),
            `seed ${seed}: block ${placed.id} intersects a writing zone`,
          ).toBe(false);
        }
      }
    }
  });

  it("keeps compiled draft elements out of the zones too", () => {
    const blocks: BoardDraftBlock[] = [
      { grammar: "text", source: "Completing the square" },
      { grammar: "text", source: "Step 1\nStep 2\nStep 3" },
      { grammar: "quiz", source: "Q: Which term completes it?\n* (b/2)^2\n- b^2" },
      { grammar: "text", source: "Worked example with a much longer heading line to widen the block" },
    ];

    for (let zones = 0; zones <= 4; zones += 1) {
      const draft = buildLessonDraft(blocks, zones);
      expect(draft.zones).toHaveLength(zones);

      for (const zone of draft.zones) {
        for (const element of draft.elements) {
          const box = boundingBox([element as Partial<Rect>]);
          if (box.width === 0 && box.height === 0) continue;
          expect(intersects(box, zone)).toBe(false);
        }
      }
    }
  });

  it("reserves nothing when the teacher asks for no writing space", () => {
    const layout = layoutBoard([{ id: "a", width: 200, height: 100 }], 0);
    expect(layout.zones).toEqual([]);
  });

  it("still reserves the requested zones when there is no content at all", () => {
    const layout = layoutBoard([], 3);
    expect(layout.zones).toHaveLength(3);
    expect(layout.placed).toEqual([]);
  });

  it("ignores a negative or fractional zone count rather than throwing", () => {
    expect(layoutBoard([], -2).zones).toEqual([]);
    expect(layoutBoard([], 2.7).zones).toHaveLength(2);
    expect(layoutBoard([], Number.NaN).zones).toEqual([]);
  });
});

describe("AIB-04 layout is deterministic", () => {
  it("produces identical output for identical input", () => {
    const blocks: LayoutBlock[] = [
      { id: "a", width: 300, height: 200 },
      { id: "b", width: 300, height: 200 },
      { id: "c", width: 150, height: 400 },
    ];
    const first = layoutBoard(blocks, 2);
    const second = layoutBoard([...blocks], 2);
    expect(second).toEqual(first);
  });

  it("does not depend on the order blocks arrive in", () => {
    const blocks: LayoutBlock[] = [
      { id: "a", width: 300, height: 200 },
      { id: "b", width: 120, height: 90 },
      { id: "c", width: 500, height: 300 },
    ];
    const forward = layoutBoard(blocks, 1);
    const reversed = layoutBoard([...blocks].reverse(), 1);
    expect(reversed.placed).toEqual(forward.placed);
  });

  it("never returns overlapping blocks", () => {
    const layout = layoutBoard(
      Array.from({ length: 9 }, (_, index) => ({ id: `b${index}`, width: 400, height: 180 })),
      2,
    );
    for (let i = 0; i < layout.placed.length; i += 1) {
      for (let j = i + 1; j < layout.placed.length; j += 1) {
        const a = layout.placed[i];
        const b = layout.placed[j];
        expect(intersects(a, b)).toBe(false);
      }
    }
  });
});

describe("AIB-03 the model returns source, never elements or coordinates", () => {
  it("drops positional fields a model tries to supply", () => {
    const stripped = stripPositionalFields({
      status: "ok",
      writingZones: 1,
      blocks: [{ grammar: "text", source: "Title", x: 10, y: 20, width: 400, position: { top: 1 } }],
    }) as { blocks: Array<Record<string, unknown>> };

    expect(stripped.blocks[0]).toEqual({ grammar: "text", source: "Title" });
  });

  it("keeps only grammar, source and title after validation", () => {
    const parsed = boardDraftResultSchema.safeParse(
      stripPositionalFields({
        status: "ok",
        writingZones: 2,
        blocks: [{ grammar: "mermaid", source: "flowchart LR\n A-->B", x: 5, elements: [{ type: "rectangle" }] }],
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(Object.keys(parsed.data.blocks[0]).sort()).toEqual(["grammar", "source", "title"]);
    expect(parsed.data.blocks[0].title).toBeUndefined();
  });

  it("rejects a grammar outside the v1.0 vocabulary", () => {
    const parsed = boardDraftResultSchema.safeParse({
      status: "ok",
      writingZones: 0,
      blocks: [{ grammar: "excalidraw", source: "{}" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("bounds the request and the result", () => {
    expect(boardDraftRequestSchema.safeParse({ topic: "ab", detail: "light", writingZones: 0 }).success).toBe(false);
    expect(
      boardDraftRequestSchema.safeParse({ topic: "completing the square", detail: "loose", writingZones: 0 }).success,
    ).toBe(false);
    expect(
      boardDraftRequestSchema.safeParse({ topic: "completing the square", detail: "light", writingZones: 99 }).success,
    ).toBe(false);
    expect(
      boardDraftResultSchema.safeParse({ status: "ok", writingZones: 0, blocks: [{ grammar: "text", source: "" }] })
        .success,
    ).toBe(false);
  });
});

describe("AIB-02 an unconfigured provider degrades, never errors", () => {
  it("returns unavailable when nothing is configured", async () => {
    const result = await new DisabledBoardAuthoringAdapter().draft({
      topic: "completing the square",
      detail: "light",
      writingZones: 1,
    });
    expect(result).toEqual({ status: "unavailable", reason: "provider_disabled" });
  });

  it("selects the disabled adapter without both credentials", () => {
    expect(getBoardAuthoringAdapter()).toBeInstanceOf(DisabledBoardAuthoringAdapter);
    process.env.BOARD_AUTHORING_API_URL = "https://draft.test";
    expect(getBoardAuthoringAdapter()).toBeInstanceOf(DisabledBoardAuthoringAdapter);
  });

  it("turns an outage, a rate limit and junk into the same unavailable outcome", async () => {
    process.env.BOARD_AUTHORING_API_URL = "https://draft.test";
    process.env.BOARD_AUTHORING_API_KEY = "key";

    const cases: Array<[string, () => Response | Promise<Response>, string]> = [
      ["outage", () => new Response("boom", { status: 500 }), "provider_unavailable"],
      ["rate limit", () => new Response("slow down", { status: 429 }), "provider_unavailable"],
      [
        "malformed result",
        () => new Response(JSON.stringify({ status: "ok", blocks: "not-an-array" }), { status: 200 }),
        "provider_invalid",
      ],
      [
        "element JSON instead of source",
        () =>
          new Response(JSON.stringify({ status: "ok", writingZones: 0, blocks: [{ elements: [] }] }), { status: 200 }),
        "provider_invalid",
      ],
    ];

    for (const [, respond, reason] of cases) {
      globalThis.fetch = (async () => respond()) as unknown as typeof fetch;
      const result = await getBoardAuthoringAdapter().draft({
        topic: "completing the square",
        detail: "light",
        writingZones: 1,
      });
      expect(result).toEqual({ status: "unavailable", reason });
    }
  });

  it("treats a transport failure as unavailable rather than throwing", async () => {
    process.env.BOARD_AUTHORING_API_URL = "https://draft.test";
    process.env.BOARD_AUTHORING_API_KEY = "key";
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(
      getBoardAuthoringAdapter().draft({ topic: "completing the square", detail: "light", writingZones: 1 }),
    ).resolves.toEqual({ status: "unavailable", reason: "provider_unavailable" });
  });
});

describe("AIB-01 a draft is usable content the teacher can review", () => {
  it("parses the documented quiz source", () => {
    expect(parseQuizSource("Q: Which activation saturates?\n* sigmoid\n- relu")).toEqual({
      prompt: "Which activation saturates?",
      options: ["sigmoid", "relu"],
      correctIndex: 0,
    });
  });

  it("records the correct option wherever it appears", () => {
    expect(parseQuizSource("Q: Pick one\n- a\n- b\n* c").correctIndex).toBe(2);
  });

  it.each([
    ["no prompt", "* a\n- b"],
    ["one option", "Q: Only one?\n* a"],
    ["no correct option", "Q: Which?\n- a\n- b"],
  ])("refuses a quiz block with %s", (_label, source) => {
    expect(() => parseQuizSource(source)).toThrow();
  });

  it("keeps the answer key off the board", () => {
    const draft = buildLessonDraft([{ grammar: "quiz", source: "Q: Which?\n* right\n- wrong" }], 0);
    const serialized = JSON.stringify(draft.elements);
    expect(serialized).not.toContain("right");
    expect(serialized).not.toContain("wrong");
    expect(serialized).not.toContain("Which?");
    // The question itself is carried separately for phase 13 to persist.
    expect(draft.questions[0].correctIndex).toBe(0);
  });

  it("places the remaining blocks when one fails to compile", () => {
    const draft = buildLessonDraft(
      [
        { grammar: "text", source: "Heading" },
        { grammar: "math", source: "\\sigma(x)" },
        { grammar: "quiz", source: "not a question" },
        { grammar: "text", source: "Closing" },
      ],
      1,
    );

    expect(draft.skipped.map((entry) => entry.grammar)).toEqual(["math", "quiz"]);
    expect(draft.warnings).toHaveLength(2);
    expect(draft.elements.length).toBeGreaterThan(0);
    expect(draft.zones).toHaveLength(1);
  });

  it("returns an empty draft rather than inventing content", () => {
    const draft = buildLessonDraft([], 2);
    expect(draft.elements).toEqual([]);
    expect(draft.questions).toEqual([]);
    expect(draft.zones).toHaveLength(2);
  });
});
