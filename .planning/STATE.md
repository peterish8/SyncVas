---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: AI Lesson Studio + MCP Interop
status: complete-local
stopped_at: null
last_updated: "2026-09-05T21:45:00.000Z"
last_activity: 2026-09-05 — Completed v1.1 phases 17–21 and v1.2 course grammars with bounded compiler registry, binary-file transport, step reveal, snippets, and volatile line pointers
progress:
  total_phases: 23
  completed_phases: 8
  total_plans: 24
  completed_plans: 10
  percent: 42
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-04)

**Core value:** Teacher stroke → students see it live; explore or follow; anonymous doubts; permanent board at end.
**Current focus:** v1.1/v1.2 grammar release verification

## Current Position

Phase: 22 of 22 (Course Grammars)
Plan: 22-01 complete
Status: v1.1 and v1.2 grammar implementation complete locally; hosted Convex/browser and XP-Pen acceptance remain external gates
Last activity: 2026-09-05 — grammar transport, teaching mechanics, security checks, tests, and production build verified

Progress: [██████████] 100% local implementation

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Foundation Close-out | 3 | 3 | — |

**Recent Trend:**

- Last 5 plans: 01-01, 01-02, 01-03
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

- 2026-09-05: Styles consolidated into `app/styles/{tokens,base,components,landing}.css` behind a thin `globals.css`; three-layer token architecture (primitives → semantic → theme); dead `landing-*`/`landing-v2-*`/`tactile-*` systems removed. See `.planning/DESIGN-DECISIONS-2026-09-05.md`.
- 2026-09-05: Teacher setup collapses to a floating room dock once live; QR moved to a compact trigger + standalone overlay; board frame gains fullscreen.

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.0 scope locked to P0+P1; P2/deferred parked as v2
- Brownfield start — do not re-scaffold Next.js/Convex/socket-server from zero
- Phase 1 complete: schema + shared protocol + green `npm run verify`
- Premature Phase 2/3 WIP quarantined under `.planning/wip/premature-phase-2-3/` for later restore
- Research skipped for Phase 1 (`workflow.research: false`); plan-checker passed
- P0 final-board persistence is Phase 6, before the P1 gate; moderation/export/history/reconnect are Phases 7–8
- P1 phases (7–9) are gated on all P0 acceptance in one teacher + two student tabs
- UI follows the warm-neutral, canvas-first system in docs/05 and docs/06; the supplied tablet reference is aesthetic only
- Controls use Tactile UI System physics on Syncvas tokens (raised press / inset inputs); see `.planning/VISUAL_DIRECTION.md`
- Core Convex/Socket work stays in its required product phases; credentialed third-party AI integration is deferred to final optional Phase 10
- Milestone v1.1 (Board Grammars) renumbered to **phases 17–21** and queued behind all of v1.0 — see MILESTONES.md and `.design/dsl-catalog.html`
- v1.1 grammars compile to native Excalidraw elements wherever possible so they ride the existing `board:update` / snapshot / export paths; only `/code` and `/math` render to images
- 2026-09-05: Prepared boards, AI board authoring, quizzes, leaderboards and MCP authoring added to **v1.0 as phases 11–16** (user decision). Design: `.design/prepared-boards-and-quizzes.html`, specs: `docs/33`–`docs/36`, `docs/38`
- Quiz runs entirely on Convex reactivity — reveal, room lock and scoring are durable low-frequency state, so the subsystem adds **zero socket events** and no relay changes
- Hidden question content is withheld server-side; the board carries only an anchor card. A client-side blur would ship the answer to every student's browser
- Student display names are collected at join and screened by `deterministicScreen()`; the doubts queue still shows no name, preserving the anonymity that protects shy students
- Quiz scoring is speed-weighted with a floor (correct answers scale from full points down to half; incorrect scores zero), so speed is rewarded without incentivising fast guessing
- Phase 12 AI authoring depends only on mermaid, not the v1.1 block primitive, so it does not wait on phase 17
- 2026-09-05: MCP lesson authoring added as **phase 16** — external AI clients (Claude, ChatGPT) author into a teacher account. Spec `docs/36_MCP_LESSON_AUTHORING.md` and `docs/38_AI_LESSON_STUDIO_AND_MCP.md`; decisions in `.planning/AI-LESSON-MCP-DECISIONS.md`
- One `LessonAuthoringService`; the in-app AI adapter and remote MCP are thin callers over it. Models emit grammar source and never Excalidraw element JSON or coordinates
- MCP is stateless at the request-processing layer; durable drafts, OAuth grants, idempotency receipts and audit records live in Convex. Advertise and test the protocol versions the deployed SDK actually supports — do not promise a historical `2026-07-28` profile is universally available
- Working reference implementation to copy: `C:\Users\nithy\nk` (NotesKit) — protected-resource metadata, grant-derived identity, PKCE, hashed tokens, revocation checked per request, scope + confirmation + rate-limit + idempotency pipeline, sanitized errors
- Hard MCP boundary: every external write is draft-only until the teacher publishes. No tool touches a live classroom or reads student data. Identity comes from the grant, never a tool argument

### Pending Todos

- Link a Convex deployment and run browser UAT for phases 3–8.
- ~~Resolve the remaining full-repo ESLint hook-rule errors.~~ Done 2026-09-05 (lint clean).
- Implement the 4 remaining scaffold test suites: moderation (7), export/history/reconnect (8), security/permissions (9), ai-adapter (10).
- Configure an optional moderation provider only if live AI triage is required.
- Wire `triageDoubt` into the doubt pipeline, or drop it — it is currently exported and called from nowhere, so MOD-02/MOD-03 exist as a boundary rather than a path.
- Surface `duplicateOf` in the teacher queue UI — it is computed and returned but no component reads it, so MOD-04 is not visible.
- Blocks v1.1: send binary `files` over the board socket path. `components/board/board-canvas.tsx:317` discards them (`void files`) and `publishScene` in `use-board-sync.ts` sends only `{ elements, appState }`, so any image-bearing element renders for the teacher and is blank for students. `boardUpdateSchema` already allows an optional 2 MB `files` field.

### Blockers/Concerns

- Local Convex may be anonymous development deployment — live `npx convex run health:status` blocked until deployment is linked; source health query intact

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Bookmarks, rewind/timeline, confusion pulse | Parked | 2026-09-04 ingest |
| v2 | AI structured notes, embedding clustering, analytics | Parked | 2026-09-04 ingest |
| v2 | Multi-writer, student annotations, HWR, A/V, attendance | Parked | 2026-09-04 ingest |
| v2 | Paid plans, org tenants | Parked | 2026-09-04 ingest |
| v1.2 | Course-specific grammars (automata, memory, bits, confusion, logic, scheduling) | Queued | 2026-09-05 v1.1 definition |

## Session Continuity

Last session: 2026-09-05
Stopped at: v1.1/v1.2 implementation and local verification
Resume file: `.planning/phases/01-foundation-close-out/01-01-PLAN.md`
Next: Link deployment and run hosted multi-browser + XP-Pen acceptance, then plan Phase 23 AI Lesson Studio + MCP Interop.

### Grammar completion (2026-09-05)

The v1.1 Board Grammars phases 17–21 and v1.2 course-specific grammars are implemented. See .planning/PHASE-V1.1-V1.2-COMPLETION.md and docs/37_BOARD_GRAMMARS.md.


### AI lesson/MCP planning (2026-09-05)

Added the unified AI Lesson Studio contract. In-app AI and remote ChatGPT/Claude MCP callers share one draft schema and authoring service; writes remain teacher-reviewed drafts. See `docs/38_AI_LESSON_STUDIO_AND_MCP.md` and `.planning/AI-LESSON-MCP-DECISIONS.md`.
