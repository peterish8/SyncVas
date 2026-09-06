# SyncVas

## What This Is

SyncVas is a classroom companion whiteboard: a teacher writes naturally with stylus/XP-Pen in Excalidraw; students join via short code or QR without accounts; the board syncs live; students pan/zoom locally or Follow Teacher; shy students submit anonymous moderated doubts; ending class persists the board with an export path.

## Core Value

Teacher stroke → students see it live; students can explore independently or follow the teacher; shy students can ask anonymous doubts; class ends with a permanent board.

## Requirements

### Validated

<!-- Milestone 0 is implemented and locally verified; this is not full product value yet. -->

- ✓ Next.js App Router app boots locally — `npm run build` and browser smoke passed
- ✓ Convex health query connected — local development deployment responds
- ✓ Socket-server health/ping path exists — live Socket.IO smoke passed
- ✓ Shared foundation protocol + Vitest coverage present — lint/typecheck/tests passed
- ✓ FOUND-01 — Monorepo `npm run verify` green (lint/typecheck/test/build) + foundation health UI — Validated in Phase 1: Foundation Close-out
- ✓ FOUND-02 — Convex v1 schema with indexed sessions/participants/doubts/votes/exports/moderationEvents — Validated in Phase 1: Foundation Close-out
- ✓ FOUND-03 — Versioned shared Socket.IO board/viewport Zod protocol consumed by app + socket-server — Validated in Phase 1: Foundation Close-out

### Active

<!-- v1.0 = P0 + P1 only. Detailed REQ IDs live in REQUIREMENTS.md. -->

- [ ] Teacher creates/ends live rooms with short code + QR join
- [ ] Excalidraw teacher board syncs live to read-only students
- [ ] Student local pan/zoom + Follow Teacher / free-roam
- [ ] Anonymous doubts with rate limits, teacher queue, answer/dismiss, same-doubt vote
- [ ] Deterministic moderation + AI triage via adapter
- [ ] End-class persistence, image/PDF export, history, reconnect UX
- [ ] Permission tests + 100-viewer load smoke + deploy hardening
- [ ] Prepared boards — teacher authors a board ahead of class, saves it as a reusable template, and starts a session on it
- [ ] AI board authoring — adapter-backed draft boards with diagrams and questions, leaving reserved space to write live
- [ ] Live quizzes — MCQ and true/false, board-anchored reveal or locked full-screen, one answer per student, graded server-side
- [ ] Leaderboards — speed-weighted scoring, student-viewable any time, teacher-projectable, frozen into class history
- [ ] MCP lesson authoring — Claude and ChatGPT write lessons and quizzes into a teacher's account as reviewable drafts

### Out of Scope

- Multi-writer / student drawing — MVP is teacher-only editor
- Student cursors / chat — explicit non-goals
- Yjs/CRDTs — single writer; no concurrent edit conflicts
- Raw high-frequency pen events in Convex — cost/perf; Socket.IO only
- Bookmarks, rewind/timeline, confusion pulse — v2 / P2
- AI structured lecture notes as product feature — v2 (end-class must still succeed if AI fails)
- Embedding-based question clustering, teacher analytics — v2
- HWR on live stroke path, A/V conferencing, attendance — deferred
- Paid plans / org tenants — deferred
- LMS replacement / public social features — not the product

## Next Milestone: v1.1 Board Grammars

**Status:** phases 17–21. Compilers, block panel and transport were implemented locally on
2026-09-05 ahead of schedule — see `.planning/PHASE-V1.1-V1.2-COMPLETION.md`. Deployment and
XP-Pen acceptance remain environment gates, and v1.0 phases 11–16 are still the priority.

**Goal:** A teacher types a short text block and the class sees compiled board content — a
themed code card, a diagram, a tensor pipeline — instead of watching shapes get drawn by hand.

**Why:** SyncVas's users are CS and AI/ML classrooms, where the things worth showing are
structured (code, graphs, trees, tensors, automata) and are slow and ugly to draw freehand.
Instructors interviewed about live coding report the same failures repeatedly: cognitive
overload from typing while explaining, the mismatch between what they say and what they type,
fear of public typos, and debugging detours that lose the room. Declarative blocks answer all
four, because the artifact is authored once and correct every time.

**Target features:**
- Block primitive + compiler registry; each grammar is a pure function, not a feature
- `/mermaid`, `/code` (six fixed themes), `/math` as the first grammar set
- Step reveal, snippet library, live line pointer
- `/ds`, `/calltree`, `/plot`, `/dp` for the DSA syllabus
- `/tensor`, `/nn` with derived shapes and parameter counts — the AI/ML differentiator

**Design reference:** `.design/dsl-catalog.html` — 18-grammar catalog, compile targets, build order.

## Context

- **Brownfield:** Repo already has Next.js (App Router), Convex health, `socket-server` package, `shared/protocol`, and vitest. Roadmap starts at foundation close-out, not empty-repo scaffold.
- **Docs spine:** `docs/03_MVP_SCOPE.md`, `docs/05_UI_UX_SPEC.md`, `docs/06_DESIGN_SYSTEM.md`, `docs/22_ROADMAP_AND_MILESTONES.md`, `docs/25_ACCEPTANCE_TESTS.md`, and `AGENTS.md` are authoritative for MVP rules.
- **Success metric:** Teacher draws in one browser; two student browsers update live; follow/free-roam works; anonymous doubts + rate limits work; end class persists board with export path — all without P2 features.
- **Gate:** Do not start P1 work (moderation polish / export / history UX) until P0 acceptance holds in 1 teacher + 2 student tabs.

## Constraints

- **Stack**: Next.js App Router + Convex + Socket.IO + Excalidraw, TypeScript strict — locked product architecture
- **Solo MVP**: Boring, reliable architecture over framework cleverness
- **Authz**: Validate every public Convex arg; ownership checks on relevant public mutations; internal work uses internal functions
- **Data path**: Indexed Convex queries only on production paths; no unindexed full-table scans
- **Realtime**: Versioned/validated Socket.IO payloads; never log raw doubt text or secret tokens in production telemetry
- **AI**: Cheap deterministic checks before AI; never hardcode LLM provider in feature code — use adapter
- **Quality**: Permission-boundary tests before polish; initial load target 100 students/room
- **UI**: Warm-neutral, low-noise classroom chrome with Tactile UI System physics (raised buttons press down; inputs are inset); softly blended color fields are contained accents only and must never cover or compete with the drawing surface
- **Visual contract**: `.planning/VISUAL_DIRECTION.md` is the implementation reference for the supplied tablet aesthetic; it is atmosphere-only and never changes the canvas-first product structure
- **Scope control**: If implementation conflicts with MVP docs, stop and report — do not silently redesign

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Convex = durable SoT + reactive app state | Sessions, doubts, votes, exports, AI jobs | ✓ Locked |
| Socket.IO = ephemeral board + viewport | Pen transport must not go through Convex reactivity | ✓ Locked |
| Excalidraw = drawing engine | MIT, embeddable React | ✓ Locked |
| No Yjs/CRDT in MVP | Teacher-only writer; no concurrent edit conflicts | ✓ Locked |
| No student cursors / no chat in MVP | Scope control | ✓ Locked |
| Teacher-only board editor | Core product rule | ✓ Locked |
| Student pan/zoom local only | Must never move teacher or other students | ✓ Locked |
| Follow mirrors teacher viewport only while enabled; manual pan/zoom exits follow locally | Product rule | ✓ Locked |
| ~~Anonymous student join~~ → **Students supply a display name at join**; doubts still anonymous in teacher UI; pseudonymous participant IDs backend | Amended 2026-09-05 for quiz leaderboards, which need legible identity. The protection that mattered is retained: the doubts queue never shows a name, so a shy student asking a question is still unidentified. Names are screened by `deterministicScreen()` before storage. | ✓ Locked (amended) |
| Do not persist raw HF pen pointer events to Convex | Cost/perf | ✓ Locked |
| Cheap spam/rate-limit before AI; AI only via adapter | Cost + portability | ✓ Locked |
| Auth abstracted (Convex Auth still evolving) | Avoid lock-in | ✓ Locked |
| v1 = P0+P1 only; P2/deferred = v2 | User-locked planning scope | ✓ Locked |
| Tablet reference informs aesthetic, not information architecture | Preserve canvas-first classroom product; use the documented warm-neutral system rather than dashboard cards | ✓ Locked |
| Third-party API configuration is last | Core Convex/Socket product paths are code-first; a live AI provider is optional and isolated behind the adapter after hardening | ✓ Locked |
| v1.1 = Board Grammars; grammars compile to Excalidraw elements, not images, wherever possible | Compiled shapes ride the existing `board:update` / snapshot / export paths with no new Convex schema, and stay hand-annotatable — which is the whole difference between a whiteboard and a slide | ✓ Locked |
| Block source lives in element `customData` | Keeps a block re-editable and re-themeable without a sidecar store; theme switching is just a recompile | ✓ Locked |
| Only `/code` and `/math` render to images; everything else is native shapes | Image blocks cost transport bytes and lose annotatability; only typographic fidelity justifies them | ✓ Locked |
| Six fixed code themes, not Shiki's full catalogue | Fine-grained Shiki bundle is ~200 KB vs 1.2 MB gzipped for the full bundle | ✓ Locked |
| v1.1 is gated on the v1.0 exit criteria | v1.0 phases 3–10 are implementation-complete but UAT-pending; grammars are the fastest way to never finish the classroom that has to work first | ✓ Locked |
| Prepared boards, AI authoring, quizzes, leaderboards and MCP authoring are v1.0 (phases 11–16); Board Grammars moves to phases 17–21 | User decision 2026-09-05 — these are first-release features, not a follow-on | ✓ Locked |
| Quiz reveal, lock and scoring run on Convex, not Socket.IO | Low-frequency, must be durable and authorized; a student refreshing mid-quiz must land back in the quiz, which an ephemeral signal cannot guarantee. Adds zero socket events. | ✓ Locked |
| Hidden question content is withheld server-side, never blurred client-side | The scene is broadcast to every student, so anything in it is already in their browser. A visual blur is not a security boundary. `correctIndex` never appears in a student-facing projection. | ✓ Locked |
| A prepared board enters the room as board version 1 over the existing `board:update` | Students receive it through the `board:current` bootstrap that already serves late joiners — no student-side change, no new transport | ✓ Locked |
| AI emits checkable source (mermaid + structured question data), never Excalidraw element JSON; layout is a deterministic function, not the model's job | ~100× smaller payloads, reviewable output, malformed generations fail at the compiler instead of corrupting a scene; models are bad at spatial arithmetic and would not reliably leave the writing zones empty | ✓ Locked |
| Quiz score is speed-weighted, not correctness-only | User decision 2026-09-05. Correct answers scale from full points down to a floor as time elapses; incorrect scores zero. The floor keeps slow-but-right worth attempting, so the incentive is not to guess fast. | ✓ Locked |
| SyncVas exposes a remote Streamable HTTP MCP endpoint for external AI clients; the same authoring core serves both the in-app adapter and MCP | Request handling is stateless while durable drafts, grants, idempotency, and audit records live in Convex. Handle client lifecycle messages for interoperability, advertise the deployed SDK version, and test ChatGPT custom-app plus Claude connector flows rather than assuming a historical profile. | ✓ Locked |
| No MCP tool touches a live classroom or reads student data | An external model can be prompt-injected by anything in the teacher's chat. Blast radius must be a bad draft the teacher declines, never content appearing in front of students. No doubts, participants, answers or leaderboards are reachable. | ✓ Locked |
| MCP identity comes from the OAuth grant, never from a tool argument | A tool argument naming a teacher is an attack, not a parameter. Mirrors the reference implementation at `C:\Users\nithy\nk`, which resolves workspace from the grant and never from input. | ✓ Locked |
| Quiz score is patched per answer, not derived from all answers on read | O(1) write vs. re-scanning a growing answer table for every one of ~100 live leaderboard subscribers; both writes happen in one transaction so they cannot drift | ✓ Locked |

## Evolution

After each phase transition:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active (and REQUIREMENTS.md)
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

---
*Last updated: 2026-09-05 — v1.1 Board Grammars defined and queued behind the v1.0 exit gate*


### AI lesson authoring decision (2026-09-05)

The in-app AI and ChatGPT/Claude MCP paths create the same `LessonDraft`: ordered grammar sources, explanations, writing zones, and quiz data. The teacher reviews and explicitly publishes a prepared template. No model can write to a live room or read student data. See `.planning/AI-LESSON-MCP-DECISIONS.md` and `docs/38_AI_LESSON_STUDIO_AND_MCP.md`.
