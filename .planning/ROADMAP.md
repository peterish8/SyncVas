# Roadmap: SyncVas

## Overview

Deliver SyncVas v1.0 on the existing brownfield scaffold, then ship the completed v1.1/v1.2 board grammars and the planned v1.3 AI Lesson Studio/MCP interoperability layer. Phases 1–10 deliver P0 + P1: close out foundation, prove teacher→student live board sync, wire real room lifecycle, add Follow Teacher, ship the anonymous doubts loop, persist the final board to close P0, then layer deterministic + adapter AI moderation, export/history/reconnect UX, and hardening. Phases 11–16 add the prepared-class layer: template library, AI board authoring, the interactive quiz subsystem with leaderboards, and an MCP server that lets external AI clients author lessons into a teacher account. P2 and explicitly deferred work stay parked under Deferred: v2.0 — not executable phases now.

**Granularity:** standard (23 phases across v1.0, v1.1, v1.2, and planned v1.3)
**Scope gate:** Phases 1–6 deliver P0. Do not start Phase 7+ until every P0 acceptance test holds in 1 teacher tab + 2 student tabs.
**Second gate:** Do not start Phase 11+ until P1 (phases 7–9) is verified. The prepared-class layer assumes a working live classroom underneath it.

## Phases

- [x] **Phase 1: Foundation Close-out** - Schema, shared protocol, and verify scripts ready on brownfield scaffold (completed 2026-09-04)
- [x] **Phase 2: Board Proof** - Teacher draws in Excalidraw; two students update live read-only (completed 2026-09-05)
 - [~] **Phase 3: Room Lifecycle** - Implementation complete; live Convex/browser verification pending
 - [~] **Phase 4: Follow Teacher** - Implementation complete; cross-device fit and UAT pending
 - [~] **Phase 5: Doubts Loop** - Implementation complete; Convex integration fixtures/UAT pending
 - [~] **Phase 6: P0 Final Board Persistence** - Implementation complete; deployed durability/UAT pending
 - [~] **Phase 7: Moderation** - Implementation complete; scheduled Convex triage/UAT pending
 - [~] **Phase 8: Export, History & Reconnect UX** - Implementation complete; hosted storage/PDF/reconnect UAT pending
 - [~] **Phase 9: Hardening** - Code/load checks complete; lint, deploy, and XP-Pen verification pending
 - [~] **Phase 10: Optional External Integrations** - Generic optional adapter complete; live provider smoke pending credentials
 - [x] **Phase 11: Prepared Boards & Template Library** - Teacher authors a board ahead of class and starts a session on it
 - [x] **Phase 12: AI Board Authoring** - Adapter-backed generation of diagrams and questions with reserved writing space
 - [ ] **Phase 13: Quiz Core** - Named participants, question model, reveal, answer, server-side grading
 - [ ] **Phase 14: Leaderboards & Locked Quiz Mode** - Speed-weighted scoring, leaderboards, full-screen locked quiz
 - [ ] **Phase 15: Quiz Persistence & History** - Quiz results freeze into the ended session alongside the final board
 - [ ] **Phase 16: MCP Lesson Authoring** - External AI clients author lessons and quizzes into a teacher account as reviewable drafts
 - [ ] **Phase 23: AI Lesson Studio & MCP Interoperability** - In-app AI and remote ChatGPT/Claude MCP create the same teacher-reviewed lesson drafts

## Phase Details

### Phase 1: Foundation Close-out

**Goal**: Brownfield scaffold is production-shaped — schema, shared protocol, and verify scripts support all later phases
**Depends on**: Nothing (first phase; scaffold already exists)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):

  1. Developer can run local health checks and see Next.js, Convex, and socket-server respond
  2. Lint, typecheck, and unit test scripts pass on the monorepo
  3. Shared protocol package exports versioned board/viewport event types consumed by app and socket-server
  4. Convex schema includes indexed tables for sessions, participants, doubts, votes, exports, and AI jobs

**Plans:** 3 plans

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Close Convex schema skeleton + indexes for v1 entities
- [x] 01-02-PLAN.md — Harden shared Socket.IO protocol types/validators + package wiring

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — Verify scripts and local health smoke path (app / Convex / socket-server)

### Phase 2: Board Proof

**Goal**: Teacher stroke appears live on two student browsers with read-only enforcement and local pan/zoom
**Depends on**: Phase 1
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06
**Success Criteria** (what must be TRUE):

  1. Teacher can draw with stylus/XP-Pen on Excalidraw and see strokes locally immediately
  2. Two student browsers show the teacher's board updates in near real time via Socket.IO
  3. A late joiner receives the current scene without replaying full stroke history
  4. Students cannot mutate board content even if they emit socket events manually
  5. Student pan/zoom does not move the teacher camera or another student's viewport

**Plans**: 1 plan

Plans:

- [x] 02-01: Excalidraw teacher canvas, validated board broadcast, late-join bootstrap, and read-only/local-viewport proof

### Phase 3: Room Lifecycle

**Goal**: Teachers create and end real sessions; students join the correct live room via code or QR without accounts
**Depends on**: Phase 2
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05
**Success Criteria** (what must be TRUE):

  1. Authenticated teacher can create a live session and receive a unique short code
  2. QR and short code both join the same live room for accountless students
  3. Ending a class rejects further joins while preserving session identity for later persistence work
  4. Teacher UI shows live student/participant count for the active room

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 03-01: Auth abstraction, durable lifecycle, code/QR join, signed socket admission, and coarse presence

### Phase 4: Follow Teacher

**Goal**: Students can mirror the teacher viewport or free-roam independently, with safe local follow exit
**Depends on**: Phase 3
**Requirements**: FOLLOW-01, FOLLOW-02, FOLLOW-03, FOLLOW-04
**Success Criteria** (what must be TRUE):

  1. Student enabling Follow Teacher mirrors the teacher's viewport while follow stays on
  2. Manual pan/zoom exits follow locally without affecting teacher or other students
  3. Student can return to Follow Teacher after free-roam
  4. Dropped/lost viewport packets do not corrupt board content

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 04-01: Teacher viewport stream, local student follow/free-roam, and packet-loss resilience

### Phase 5: Doubts Loop

**Goal**: Anonymous doubt submission loop works end-to-end without AI — rate limits, queue, resolve, vote
**Depends on**: Phase 4
**Requirements**: DOUBT-01, DOUBT-02, DOUBT-03, DOUBT-04, DOUBT-05
**Success Criteria** (what must be TRUE):

  1. Student can submit a doubt that shows no student name in the teacher UI
  2. Spammy repeats from the same participant hit rate limits without calling AI
  3. Teacher sees a reactive queue and can mark doubts answered or dismissed
  4. A participant can vote a doubt only once (same-doubt vote)

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 05-01: Anonymous participant records, rate-limited doubts, teacher queue, resolution, and voting

### Phase 6: P0 Final Board Persistence

**Goal**: Ending class persists a durable final board scene so the P0 gate is actually testable
**Depends on**: Phase 5
**Requirements**: EXPORT-01
**Success Criteria** (what must be TRUE):

  1. Ending a class persists the final board scene as durable state
  2. The final scene survives a teacher/student refresh or a later reopen path appropriate to the ended session
  3. No raw high-frequency pen event stream is persisted to Convex

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 06-01: End-class finalization, durable final-scene restore, and P0 acceptance evidence

### Phase 7: Moderation

**Goal**: Noise is filtered cheaply first; AI triage via adapter improves relevance without silent drops
**Depends on**: Phase 6 and the P0 gate (all P0 acceptance in 1 teacher + 2 student tabs)
**Requirements**: MOD-01, MOD-02, MOD-03, MOD-04
**Success Criteria** (what must be TRUE):

  1. Profanity/noise rules block obvious junk before any AI call
  2. Relevance triage is represented only through a provider-agnostic adapter contract; an unconfigured adapter safely returns an uncertain outcome
  3. Uncertain or failed AI classification does not silently lose a plausible doubt
  4. Teacher can see duplicate suggestions for similar doubts

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 07-01: Deterministic screening, disabled-provider adapter boundary, uncertain fallback, and duplicate suggestions

### Phase 8: Export, History & Reconnect UX

**Goal**: The already-persisted final board gains export/history paths and graceful reconnect/error UX
**Depends on**: Phase 7
**Requirements**: EXPORT-02, EXPORT-03, EXPORT-04, UX-01, UX-02
**Success Criteria** (what must be TRUE):

  1. Teacher can export the final board as image and/or PDF and see export job state
  2. Past classes appear on a teacher history page
  3. Refresh/reconnect restores the latest board; join/queue/history failures show clear empty/error states
  4. Optional AI summary failure does not lose the persisted board

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 08-01: Export job state, teacher history, reconnect/resync, and error/empty UX

### Phase 9: Hardening

**Goal**: Permission boundaries, load target, and production deploy are proven for v1 demo reliability
**Depends on**: Phase 8
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, LOAD-01
**Success Criteria** (what must be TRUE):

  1. Student clients cannot impersonate teacher via spoofed role fields; cross-room leakage tests pass
  2. Convex public mutations enforce ownership/authorization; secrets are absent from the browser bundle
  3. Automated permission-boundary tests cover teacher vs student capabilities
  4. One teacher + 100 viewers smoke/load test is completed with documented results
  5. Production deploy path works and XP-Pen writing is verified in the production desktop browser target

**Plans**: TBD

Plans:

- [ ] 09-01: Permission/cross-room tests, 100-viewer smoke, production runbook, and XP-Pen verification

### Phase 10: Optional External Integrations
**Goal**: A configured third-party AI provider enhances moderation through the existing adapter without becoming a dependency of classroom reliability
**Depends on**: Phase 9
**Requirements**: MOD-02
**Success Criteria** (what must be TRUE):
  1. Provider credentials remain server-only and are absent from browser bundles and logs
  2. A configured provider receives the adapter’s minimal, validated moderation request and produces a validated result
  3. Timeout, malformed result, rate limit, or provider outage returns the same safe uncertain fallback used when no provider is configured
  4. The classroom, doubts queue, final-board persistence, and export paths remain operational with the integration disabled
**Plans**: TBD

Plans:
- [ ] 10-01: Server-only provider configuration, adapter implementation, and contract/failure-mode verification

### Phase 11: Prepared Boards & Template Library

**Goal**: A teacher authors a board before class, saves it, and starts a session already showing it
**Depends on**: Phase 9 (P1 verified)
**Requirements**: PREP-01, PREP-02, PREP-03, PREP-04, PREP-05
**Success Criteria** (what must be TRUE):

  1. Teacher can save the current board as a reusable named template owned by them
  2. Teacher can list, open, rename and delete their own templates, and cannot see another teacher's
  3. Starting a session from a template opens the class with that scene already on the board
  4. Students joining that session receive the prepared scene through the existing `board:current` bootstrap with no student-side change
  5. Every element of a prepared board remains freely movable and editable by the teacher during class

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 11-01: TBD (run `/gsd:plan-phase 11`)

### Phase 12: AI Board Authoring

**Goal**: A teacher describes a lesson and gets a usable starting board with space left to write
**Depends on**: Phase 11
**Requirements**: AIB-01, AIB-02, AIB-03, AIB-04
**Success Criteria** (what must be TRUE):

  1. Teacher can describe a topic and receive a generated draft board they can accept, edit, or discard
  2. Generation runs through a provider-agnostic adapter with server-only credentials; an unconfigured provider degrades to a clear unavailable state rather than an error
  3. Generated content is emitted as checkable source (mermaid and structured question data), never as raw Excalidraw element JSON
  4. Element placement is computed by a deterministic layout function, not by the model, and requested writing zones are verifiably empty of elements

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 12-01: TBD (run `/gsd:plan-phase 12`)

### Phase 13: Quiz Core

**Goal**: A teacher can place questions, reveal them, and have students answer with correct grading
**Depends on**: Phase 10, Phase 11
**Requirements**: QUIZ-01, QUIZ-02, QUIZ-03, QUIZ-04, QUIZ-05, QUIZ-06
**Success Criteria** (what must be TRUE):

  1. Student supplies a display name at join, screened by the existing deterministic filter; doubts remain anonymous and never carry that name
  2. Teacher can author MCQ and true/false questions against a session and anchor them to a board position
  3. A hidden question's prompt, options and answer key are absent from every student-facing payload — verified by inspecting the network response, not by visual blur
  4. Revealing a question makes its prompt and options available to students and places it on the board
  5. A participant can answer a given question at most once, enforced by a unique index
  6. Grading happens server-side inside the mutation; `correctIndex` never appears in a student projection

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 13-01: TBD (run `/gsd:plan-phase 13`)

### Phase 14: Leaderboards & Locked Quiz Mode

**Goal**: Answers produce a speed-weighted score and a leaderboard both sides can see; a final quiz can take over the room
**Depends on**: Phase 13
**Requirements**: QUIZ-07, LEAD-01, LEAD-02, LEAD-03, LEAD-04
**Success Criteria** (what must be TRUE):

  1. A correct answer scores points that decrease with elapsed time, down to a floor; an incorrect answer scores zero
  2. Score is maintained per answer in constant time; the leaderboard is an indexed read, not a scan over all answers
  3. Student can open a leaderboard at any time and see their own standing
  4. Teacher can project a per-question and a cumulative leaderboard
  5. Teacher can lock the room into full-screen quiz mode; students lose canvas interaction, and a student refreshing mid-quiz returns to the quiz rather than a stale board
  6. Board-anchored and full-screen questions can both be used within one class

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 14-01: TBD (run `/gsd:plan-phase 14`)

### Phase 15: Quiz Persistence & History

**Goal**: Ending a class freezes quiz results next to the final board
**Depends on**: Phase 14, Phase 8
**Requirements**: QUIZ-08, LEAD-05
**Success Criteria** (what must be TRUE):

  1. Ending a class closes any open question and freezes the final leaderboard
  2. An ended session's history entry shows both the final board and the final quiz results
  3. Quiz results are included in the teacher's export path
  4. A quiz that was never run does not create empty results or block end-of-class finalization

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 15-01: TBD (run `/gsd:plan-phase 15`)

### Phase 16: MCP Lesson Authoring

**Goal**: An external AI client (Claude, ChatGPT) can author lessons and quizzes into a teacher's SyncVas account, as reviewable drafts
**Depends on**: Phase 12, Phase 13
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06
**Success Criteria** (what must be TRUE):

  1. SyncVas exposes a remote MCP server implementing spec `2026-07-28` — stateless, no session header, with a working `server/discover`
  2. A teacher can connect the server from Claude and from ChatGPT and authorize it against their own account
  3. An external client can create a lesson draft containing diagram source and quiz questions, and read back what it created
  4. Every write lands as a **draft the teacher reviews** — no MCP tool can publish to a live room or reveal a question
  5. No student data is reachable through any MCP tool: no doubts, no participants, no answers, no leaderboards
  6. A revoked token immediately stops working, and tokens are scoped to one teacher

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 16-01: TBD (run `/gsd:plan-phase 16`)

## Milestone v1.1: Board Grammars

**Status: complete — implemented locally 2026-09-05.** Hosted Convex/browser and XP-Pen acceptance remain tracked v1.0 environment gates.

**Goal:** A teacher types a short text block and the class sees compiled board content — a
themed code card, a diagram, a tensor pipeline — instead of watching shapes get drawn by hand.

**Core architecture:** one block primitive plus a compiler registry. Each grammar is a pure
function `(source, opts) => { elements, files }` targeting Excalidraw's exported
`convertToExcalidrawElements`. Block source lives in the element's `customData`, so a block
stays re-editable and re-themeable. Compiled output is ordinary Excalidraw content, so it
rides the existing `board:update` event, the existing final snapshot, and the existing export
path — no new Convex schema, no change to the teacher-only-writer rule.

**Design reference:** `.design/dsl-catalog.html`

**Granularity:** standard (5 phases, completed in one bounded implementation pass)

### Phase 17: Block Transport & Primitive

**Goal**: A teacher can render a block onto the board and every student sees it, including image-bearing blocks
**Depends on**: v1.0 exit criteria (phases 1–16)
**Requirements**: BLOCK-01, BLOCK-02, BLOCK-03, BLOCK-04, BLOCK-05, BLOCK-06
**Success Criteria** (what must be TRUE):

  1. A teacher-inserted image element renders identically on a student client (closes the `files` gap)
  2. Teacher can open a block panel, enter a source, and see compiled content appear on the board
  3. A compiled block survives refresh, end-of-class persistence, and export like any hand-drawn content
  4. Reopening a block recovers its original source and options for editing
  5. An unparseable source shows an error and leaves the board unchanged
  6. A block that would exceed the scene or file byte budget is rejected before emit

**Plans**: 1 plan
**UI hint**: yes

Plans:

- [x] 17-01: Block compiler registry, bounded transport, binary file bootstrap, and block panel

### Phase 18: First Grammars — mermaid, code, math

**Goal**: The three highest-leverage grammars work end to end on a live board
**Depends on**: Phase 17
**Requirements**: GRAM-01, GRAM-02, GRAM-03, GRAM-04
**Success Criteria** (what must be TRUE):

  1. A mermaid flowchart, sequence, class, ER or state diagram compiles to shapes the teacher can then annotate by hand
  2. An unsupported mermaid type still renders, as an image, rather than failing
  3. A code block renders with VS Code-fidelity highlighting in any of six fixed themes
  4. A code block can show line numbers, dim to a focus range, and render a diff
  5. A LaTeX equation renders legibly at classroom projection size

**Plans**: 1 plan
**UI hint**: yes

Plans:

- [x] 18-01: Mermaid, code, math grammars with safe SVG fallback and six themes

### Phase 19: Teaching Mechanics

**Goal**: Blocks become teachable — disclosed in steps, reusable, and pointable-at
**Depends on**: Phase 18
**Requirements**: TEACH-01, TEACH-02, TEACH-03, TEACH-04
**Success Criteria** (what must be TRUE):

  1. Teacher can reveal a block in author-defined chunks rather than all at once
  2. Teacher can save a block and re-insert it in a later class in one action
  3. Teacher highlighting a line is visible to students and never bumps board version or blocks on delivery
  4. A block's theme follows the board theme by default and can be overridden per block

**Plans**: 1 plan
**UI hint**: yes

Plans:

- [x] 19-01: Step reveal, snippet library, line pointer, and theme defaults

### Phase 20: CS Grammars

**Goal**: The data-structures and algorithms syllabus is drawable from text
**Depends on**: Phase 19
**Requirements**: GRAM-05, GRAM-06, GRAM-09, GRAM-10
**Success Criteria** (what must be TRUE):

  1. Array, linked list, stack/queue, tree, graph and hash table each render from a one-line source
  2. A recursion tree expands from a call, with repeated subcalls visually distinct
  3. Complexity-growth and named function curves render on labelled axes
  4. A DP grid or execution trace renders as a table with a declared fill order

**Plans**: 1 plan
**UI hint**: yes

Plans:

- [x] 20-01: Data structures, call trees, plots, DP and trace grammars

### Phase 21: AI/ML Grammars

**Goal**: Shape and parameter arithmetic is derived on the board, not typed
**Depends on**: Phase 20
**Requirements**: GRAM-07, GRAM-08
**Success Criteria** (what must be TRUE):

  1. A tensor pipeline derives each layer's output shape rather than requiring it to be written
  2. Changing a layer parameter updates every downstream shape
  3. A network layer stack renders with derived per-layer parameter counts
  4. A shape mismatch is reported clearly instead of rendering a wrong diagram

**Plans**: 1 plan
**UI hint**: yes

Plans:

- [x] 21-01: Tensor and neural-network shape/parameter grammars

## v1.2: Course-specific grammars

**Status: complete — implemented locally 2026-09-05.** Automata, memory diagrams, bit fields, confusion matrix, digital logic, scheduling, matrix, and table compilers are registered and bounded. See `docs/37_BOARD_GRAMMARS.md`.

## Milestone v1.3: AI Lesson Studio & MCP Interop

**Status:** planned — design contract added 2026-09-05.
**Goal:** A teacher can generate a complete, reviewable lesson in SyncVas or from ChatGPT/Claude, then teach it from a prepared board and quiz.
**Depends on:** v1.0 prepared-class layer, v1.1/v1.2 grammar registry, authenticated teacher path, and hosted MCP HTTPS/OAuth.
**Source of truth:** `docs/38_AI_LESSON_STUDIO_AND_MCP.md` and `.planning/AI-LESSON-MCP-DECISIONS.md`.

### Phase 23: AI Lesson Studio & MCP Interoperability

**Requirements:** AI-LESSON-01..08

**Success criteria:**

1. In-app AI and remote MCP create the same validated `LessonDraft` through one authoring service.
2. Drafts contain grammar source, explanations, writing zones, and quiz data; raw Excalidraw JSON and coordinates are rejected.
3. Teacher review, edit, publish, and discard are explicit; no model can write to a live room.
4. ChatGPT custom-app and Claude remote MCP discovery/OAuth/tool calls work against the hosted Streamable HTTP endpoint where the client plan supports custom writes.
5. Long generations resume by idempotent parts; failures leave a resumable draft and never partially publish.
6. Student projections omit answer keys, grants, prompts, and other teacher-only metadata.
7. Connections UI shows client, scopes, last use, and immediate revoke.
8. Origin validation, PKCE, rate limits, sanitized errors, no-store responses, hashed tokens, and audit events pass security tests.

**Plans:** TBD — run `/gsd:plan-phase 23` when implementation begins.

## Deferred: v2.0

Not executable now. Do not create phases or plans for these until v1.0 ships.

- Bookmarks, periodic snapshots-as-product, rewind/timeline
- Confusion pulse
- AI structured lecture notes / summary product pipeline
- Embedding-based question clustering
- Teacher analytics
- Multi-writer canvas, student annotations
- HWR on live stroke path
- Audio/video, attendance
- Paid plans, org/college tenants

See REQUIREMENTS.md `## v2 Requirements` for IDs.

## Progress

**Execution Order:**
1 → 2 → 3 → 4 → 5 → 6 → **P0 gate** → 7 → 8 → 9 → 10 → **P1 gate** → 11 → 12 → 13 → 14 → 15 → 16 → **v1.0 exit gate** → 17 → 18 → 19 → 20 → 21 → **v1.1/v1.2 complete** → 23

Phase 12 (AI authoring) depends only on mermaid, not on the v1.1 block primitive, so it does
not wait for phase 16. Phase 13 (quiz core) depends on phase 11 for board-anchored questions
and on phase 10 for the moderation screen applied to student display names.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Close-out | 3/3 | Complete | 2026-09-04 |
| 2. Board Proof | 1/1 | Complete | 2026-09-05 |
| 3. Room Lifecycle | 1/1 | Implementation complete; UAT pending | 2026-09-05 |
| 4. Follow Teacher | 1/1 | Implementation complete; UAT pending | 2026-09-05 |
| 5. Doubts Loop | 1/1 | Implementation complete; UAT pending | 2026-09-05 |
| 6. P0 Final Board Persistence | 1/1 | Implementation complete; deployment pending | 2026-09-05 |
| 7. Moderation | 1/1 | Implementation complete; deployment pending | 2026-09-05 |
| 8. Export, History & Reconnect UX | 1/1 | Implementation complete; UAT pending | 2026-09-05 |
| 9. Hardening | 1/1 | Code/load complete; deploy/hardware pending | 2026-09-05 |
| 10. Optional External Integrations | 1/1 | Disabled-safe adapter complete; provider pending | 2026-09-05 |
| — | — | *P1 gate* | — |
| 11. Prepared Boards & Template Library | 0/? | Not started (v1.0) | — |
| 12. AI Board Authoring | 0/? | Not started (v1.0) | — |
| 13. Quiz Core | 0/? | Not started (v1.0) | — |
| 14. Leaderboards & Locked Quiz Mode | 0/? | Not started (v1.0) | — |
| 15. Quiz Persistence & History | 0/? | Not started (v1.0) | — |
| 16. MCP Lesson Authoring | 0/? | Not started (v1.0) | — |
| — | — | *v1.0 exit gate* | — |
| 17. Block Transport & Primitive | 1/1 | Complete | 2026-09-05 |
| 18. First Grammars | 1/1 | Complete | 2026-09-05 |
| 19. Teaching Mechanics | 1/1 | Complete | 2026-09-05 |
| 20. CS Grammars | 1/1 | Complete | 2026-09-05 |
| 21. AI/ML Grammars | 1/1 | Complete | 2026-09-05 |
| 22. Course Grammars | 1/1 | Complete | 2026-09-05 |
| 23. AI Lesson Studio & MCP Interoperability | 0/? | Planned | — |
| 24. Backend Cost & Depth | 2/6 | In progress (v1.4) | — |

### Phase 24 — Backend Cost & Depth (v1.4)

From the backend architecture review of 2026-09-07. Measurements, assumptions, sequencing
and spec alignment: `.planning/BACKEND-OPTIMIZATION-DECISIONS.md`.

Five of the six plans implement specs the code does not yet follow (docs/21 "keep reactive
queries narrow", docs/11 "incremental scene state"); none changes a non-negotiable rule in
AGENTS.md. Phase 24 is independent of phases 11–16 and 23 and can run alongside them,
except that 24-05 rewrites 29 Convex exports and wants a quiet tree.

| Wave | Plan | Requirement | Scope |
|---|---|---|---|
| 1 | 24-01 | COST-02 | **Complete 2026-09-07** — counters on the parent doc; reactive N+1 collects removed |
| 1 | 24-02 | COST-03 | **Complete 2026-09-07** — indexed duplicate detection; duplicates reuse the triage verdict |
| 2 | 24-03 | DEPTH-01, COST-04 | One socket admission interface; fixes the two defects it caused |
| 3 | 24-04 | COST-01 | Element patch stream replaces full-scene broadcast |
| 4 | 24-05 | DEPTH-02 | One teacher-identity interface; delete 29 dev twins |
| 5 | 24-06 | DEPTH-03 | **Blocked** — reverses a CLAUDE.md decision, needs a ruling |

Start at 24-01: contained to Convex handlers, no protocol change, no deploy coordination,
and it removes the O(students²) reads before the quiz UI lands and starts paying for them.
24-04 is the larger cost line by an order of magnitude but changes the wire format, so it
takes its own cycle.
