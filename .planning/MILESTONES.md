# Milestones: SyncVas

Ledger of milestone scope and status. Detailed requirements live in `REQUIREMENTS.md`;
phase structure lives in `ROADMAP.md`.

## v1.0 — P0 + P1 classroom MVP

**Status:** in progress (executing)
**Phases:** 1–16
**Goal:** Teacher stroke → students see it live; students explore or follow; anonymous
moderated doubts; class ends with a permanent board plus an export path. Plus a prepared-class
layer: walk in with the board already built, and run interactive quizzes during the lesson.

**Scope, phases 1–10 (P0 + P1):** foundation close-out, board proof, room lifecycle, follow
teacher, doubts loop, final board persistence, moderation, export/history/reconnect UX,
hardening, and an optional external AI provider behind the existing adapter.

**Scope, phases 11–16 (prepared-class layer):** board template library, AI board authoring
through the adapter, quiz core with server-side grading, speed-weighted leaderboards and
locked full-screen quiz mode, quiz results frozen into class history, and an MCP server
(spec 2026-07-28) letting Claude and ChatGPT author lessons into a teacher account as
reviewable drafts.

**Design reference:** `.design/prepared-boards-and-quizzes.html`

**Specs:** `docs/33_PREPARED_BOARDS_AND_TEMPLATES.md`, `docs/34_AI_BOARD_AUTHORING.md`,
`docs/35_QUIZ_AND_LEADERBOARD.md`, `docs/36_MCP_LESSON_AUTHORING.md`

**Exit criteria** (all must hold before v1.1 begins):
- Every P0 acceptance test passes in 1 teacher tab + 2 student tabs
- Deploy-linked Convex + browser UAT run for phases 3–8
- Authenticated teacher path in use; `ALLOW_DEV_TEACHER` / `ALLOW_PROOF_SOCKET` off in production
- Remaining full-repo ESLint hook-rule errors resolved
- XP-Pen writing verified in the production desktop browser target
- Phases 11–16 delivered

## v1.1 — Board Grammars

**Status:** complete — implemented locally 2026-09-05
**Phases:** 17–21
**Goal:** A teacher types a short text block and the class sees compiled board content — a
themed code card, a diagram, a tensor pipeline — instead of watching shapes get drawn by hand.

**Scope:** block primitive and compiler registry; `/mermaid`, `/code`, `/math`; step reveal,
snippet library and live line pointer; `/ds`, `/calltree`, `/plot`, `/dp`; `/tensor`, `/nn`.

**Design reference:** `.design/dsl-catalog.html`

**Course-specific grammars (v1.2):** implemented in the same bounded registry and transport pass; see `docs/37_BOARD_GRAMMARS.md`.

## v1.2 — Course-specific grammars

**Status:** complete — implemented locally 2026-09-05
**Scope:** automata, memory diagrams, bit fields, confusion matrices, digital logic, scheduling, matrices, and comparison tables.
**Verification:** covered by compiler bounds and registry tests; hosted browser/XP-Pen acceptance remains an external gate.

## v1.3 — AI Lesson Studio & MCP Interop

**Status:** planned — design contract added 2026-09-05
**Goal:** The in-app AI and remote ChatGPT/Claude MCP clients author the same complete lesson and quiz draft for teacher review.
**Phase:** 23
**Spec:** `docs/38_AI_LESSON_STUDIO_AND_MCP.md`

## v2.0 — Deferred platform

**Status:** parked
**Goal:** Not defined. Tracked only so scope stays out of v1.x.

**Scope:** bookmarks and rewind/timeline, confusion pulse, AI structured lecture notes,
embedding-based question clustering, teacher analytics, multi-writer canvas and student
annotations, handwriting recognition on the live stroke path, audio/video and attendance,
paid plans and org tenants.

---
*Created 2026-09-05 when v1.1 was defined. Updated the same day when phases 11–16 were added to v1.0.*
