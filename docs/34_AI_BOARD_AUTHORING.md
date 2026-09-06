# 34 — AI Board Authoring

Phase 12. Requirements AIB-01..04.

## Goal

A teacher describes a lesson and gets a usable draft board — diagrams, equations, explanations, and question
cards — with space deliberately left empty to write in live. The same authoring contract is also callable by the remote MCP tools used from ChatGPT and Claude; only the caller changes.

## Two rules that define this feature

**1. The model returns source, never Excalidraw elements.**
Element JSON is megabytes of coordinates, seeds and version counters. It is unreviewable, slow
and expensive to generate, and one malformed field produces a corrupt scene that fails deep
inside the canvas. Grammar source is a few hundred bytes, diffable, and fails at our compiler
with a clear message before anything reaches the board.

**2. The model never decides coordinates.**
Language models are weak at spatial arithmetic. Asked for positions they produce overlapping
boxes and quietly fill the space that was supposed to stay empty. The model produces content
and a count of writing zones; a deterministic layout function does the geometry.

## Adapter

Same shape and same rules as `lib/ai/moderation-adapter.ts`. Provider-agnostic interface,
server-only credentials, never imported by UI or feature code.

```ts
export interface BoardAuthoringAdapter {
  draft(req: BoardDraftRequest): Promise<BoardDraftResult>;
}
```

- Unconfigured → `DisabledBoardAuthoringAdapter` returns `{ status: "unavailable" }`. The UI
  shows "AI drafting is not configured", never an error dialog.
- Timeout, malformed result, rate limit and provider outage all return the same
  `unavailable` outcome. Board authoring is never a dependency of classroom reliability.
- Never log prompts or generated content in production telemetry, matching the doubt-text rule.

## Request

```ts
{
  topic: string,        // "completing the square, class 9"
  subject?: string,
  detail: "light" | "standard",
  writingZones: number  // how much blank space the teacher wants
}
```

## Result — validate with Zod before use

```ts
{
  status: "ok",
  blocks: [
    { grammar: "mermaid", source: "flowchart LR\n A[Input]-->B[Hidden]-->C[Output]" },
    { grammar: "math",    source: "\\sigma(x)=\\frac{1}{1+e^{-x}}" },
    { grammar: "text",    source: "Completing the square" },
    { grammar: "quiz",    source: "Q: Which activation saturates?\n* sigmoid\n- relu" }
  ],
  writingZones: 2
}
```

No `x`, no `y`, no `width`. If a result contains positional fields, drop them.

## v1.0 grammar scope

Phase 12 must not wait on the v1.1 block primitive (phase 16). Supported grammars in v1.0:

| Grammar | Compiles via | Notes |
|---------|--------------|-------|
| `mermaid` | `@excalidraw/mermaid-to-excalidraw` | Standalone MIT library; native shapes for flowchart, sequence, class, ER, state |
| `text` | Excalidraw text element | Headings and labels |
| `quiz` | `quizQuestions` row + anchor card | See `docs/35_QUIZ_AND_LEADERBOARD.md` |
| `math` | Deferred to phase 17 | Needs the KaTeX render path |

A returned grammar we cannot compile yet is skipped with a visible note, not an error.

## Layout function

Pure, deterministic, unit-testable, no model involvement:

```ts
layoutBoard(blocks: CompiledBlock[], zones: number, canvas: Size): PlacedBlock[]
```

- Places compiled blocks on a coarse grid, largest first
- Reserves `zones` rectangular regions and emits no element intersecting them
- Returns positions only; never mutates element content
- Same input → same output, so a draft can be regenerated without the board jumping

**Test that matters:** for any generated board, assert that no element's bounding box
intersects a reserved zone. That is AIB-04 and it is the requirement most likely to regress.

## Review gate

Generated content lands in a **draft** state the teacher accepts, edits, or discards. It never
publishes to a live room directly. Accepting saves it as a `boardTemplates` row with
`origin: "ai-assisted"`.

## Failure modes

| Case | Behavior |
|------|----------|
| No provider configured | `unavailable`; UI offers manual authoring |
| Timeout / outage / rate limit | `unavailable`; draft unchanged |
| Result fails schema validation | Treated as `unavailable`; nothing partially applied |
| One block fails to compile | Other blocks still place; failed block reported by name |
| Model returns coordinates | Stripped before layout |
| Zero blocks returned | Empty draft with a clear message, not a blank saved template |

## Acceptance

1. Describe a topic, receive a draft with at least one compiled diagram
2. No configured provider → clear unavailable state, no error dialog, manual path still works
3. Generated payload contains grammar source and no element JSON
4. Requested writing zones are empty of elements, asserted by test
5. Discarding a draft leaves no template behind; accepting creates one marked `ai-assisted`


## Shared authoring contract

The in-app adapter and MCP endpoint must call the same teacher-owned `LessonAuthoringService`. MCP and in-app generation are never separate content models. See `docs/38_AI_LESSON_STUDIO_AND_MCP.md` for the LessonDraft schema, draft-only write boundary, and interoperability/security decisions.
