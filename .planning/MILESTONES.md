# Milestones: SyncVas

Ledger of milestone scope and status. Detailed requirements live in `REQUIREMENTS.md`;
phase structure lives in `ROADMAP.md`.

## v1.0 — P0 + P1 classroom MVP

**Status:** in progress (executing)
**Phases:** 1–10
**Goal:** Teacher stroke → students see it live; students explore or follow; anonymous
moderated doubts; class ends with a permanent board plus an export path.

**Scope:** foundation close-out, board proof, room lifecycle, follow teacher, doubts loop,
final board persistence, moderation, export/history/reconnect UX, hardening, and an optional
external AI provider behind the existing adapter.

**Exit criteria** (all must hold before v1.1 begins):
- Every P0 acceptance test passes in 1 teacher tab + 2 student tabs
- Deploy-linked Convex + browser UAT run for phases 3–8
- Authenticated teacher path in use; `ALLOW_DEV_TEACHER` / `ALLOW_PROOF_SOCKET` off in production
- Remaining full-repo ESLint hook-rule errors resolved
- XP-Pen writing verified in the production desktop browser target

## v1.1 — Board Grammars

**Status:** queued (not started)
**Phases:** 11–15
**Goal:** A teacher types a short text block and the class sees compiled board content — a
themed code card, a diagram, a tensor pipeline — instead of watching shapes get drawn by hand.

**Scope:** block primitive and compiler registry; `/mermaid`, `/code`, `/math`; step reveal,
snippet library and live line pointer; `/ds`, `/calltree`, `/plot`, `/dp`; `/tensor`, `/nn`.

**Design reference:** `.design/dsl-catalog.html`

**Deferred to v1.2:** course-specific grammars — automata, memory diagrams, bit fields,
confusion matrix, digital logic, scheduling/matrix/table.

## v2.0 — Deferred platform

**Status:** parked
**Goal:** Not defined. Tracked only so scope stays out of v1.x.

**Scope:** bookmarks and rewind/timeline, confusion pulse, AI structured lecture notes,
embedding-based question clustering, teacher analytics, multi-writer canvas and student
annotations, handwriting recognition on the live stroke path, audio/video and attendance,
paid plans and org tenants.

---
*Created 2026-09-05 when v1.1 was defined.*
