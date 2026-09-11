# 39 — AI Summary Setup (Gemini)

Implementation runbook for the pipeline specified in `docs/15_AI_SUMMARY_PIPELINE.md`.

## Turning it on

The summary runs inside a **Convex action**, so the key must be set on the Convex
deployment. Putting it only in `.env.local` will not work.

```bash
npx convex env set AI_PROVIDER gemini
npx convex env set GOOGLE_GENERATIVE_AI_API_KEY <your-key>
# optional, defaults to gemini-2.5-flash
npx convex env set GEMINI_MODEL gemini-2.5-flash
```

Get a free key at <https://aistudio.google.com/apikey>.

`AI_PROVIDER` values:

| Value | Behaviour |
| --- | --- |
| `mock` (default) | Deterministic offline notes. Exercises the whole pipeline with no key and no network. |
| `gemini` | Real notes. Falls back to disabled if the key is absent. |
| anything else | Disabled — summary is marked `skipped`, board and exports unaffected. |

## Flow

```
teacher ends class
  → sessions.end            status: live → ending
  → internal/revokeRoom     sockets evicted
  → sessions.finalize       status: ending → ended   (board is durable HERE)
  → internal/summarize.run  best-effort, downstream of everything above
```

`finalize` schedules the summary and returns. Nothing about ending a class waits
on, or fails because of, the AI provider.

## Status machine

`sessionSummaries.status` is one row per session:

- `processing` — claimed; a second schedule is a no-op, so a double End Class cannot double-bill the API
- `ready` — `notesJson` holds a validated `SummaryResult`
- `failed` — provider error; teacher can retry from the notes panel
- `skipped` — no provider configured, or the board had too little readable content

Only a `ready` row returns `notesJson`; a failed row never leaks a partial draft.

## Where the pieces live

| Path | Role |
| --- | --- |
| `lib/ai/summary-adapter.ts` | Schemas, `SummaryAdapter`, `normalizeSummaryResult`, mock/disabled adapters |
| `lib/ai/summary.ts` | `getSummaryAdapter()` — the only provider-selection point |
| `lib/ai/providers/gemini.ts` | Gemini REST call with structured output |
| `lib/summary-input.ts` | Final scene → board text + block sources |
| `lib/summary-visuals.ts` | Parsers for the emitted charts |
| `convex/internal/summarize.ts` | The internal action and its status mutations |
| `convex/summaries.ts` | Student read, teacher read, teacher regenerate |
| `components/summary/` | Notes page and teacher panel |
| `app/student/[sessionId]/notes` | Student-facing notes route |

## Charts without an image API

`SUMMARY_VISUAL_GRAMMARS` is `mermaid | plot | table`. The model emits source in
those grammars and `components/summary/summary-visual.tsx` renders them as inline
SVG/HTML — sharp, theme-aware, and free. A visual that fails to parse degrades to
its caption rather than blanking the page.

## Adding image generation later

The model already emits `imagePrompts` (`slot`, `prompt`, `alt`) on every
summary; they are stored and currently unrendered. Enabling images is therefore a
rendering change over existing rows, not a re-run:

1. Add `lib/ai/providers/<vendor>-images.ts` behind an `ImageAdapter` interface.
2. Generate from stored `imagePrompts`, upload to Convex `_storage`.
3. Record storage ids on the summary row and render them in `class-summary.tsx`.

## Adding OpenAI later

1. Write `lib/ai/providers/openai.ts` exporting a class that implements
   `SummaryAdapter` (return `normalizeSummaryResult(raw, input.title)`).
2. Add the case to `getSummaryAdapter()` in `lib/ai/summary.ts`.

No caller changes. `AI_PROVIDER=openai` currently resolves to disabled by design,
so a half-finished switch cannot silently route traffic to the wrong vendor.

## Hallucination controls

Enforced in the Gemini system instruction and the stored schema:

- board text, board blocks and doubts are the only permitted sources
- unreadable handwriting becomes `confidence: "uncertain"` plus an entry in `uncertainNotes`
- omission is preferred to guessing
- the student page carries a visible AI-generated disclaimer
