# Requirements: SyncVas

**Defined:** 2026-09-04
**Core Value:** Teacher stroke → students see it live; students explore or follow; anonymous doubts; class ends with a permanent board.

## v1 Requirements

Requirements for v1.0. Phases 1–10 are P0 + P1; phases 11–16 add the prepared-class layer
(templates, AI authoring, quizzes, leaderboards, MCP authoring). Each maps to exactly one roadmap phase.

### Cross-cutting visual system

Every UI phase must follow `docs/05_UI_UX_SPEC.md`, `docs/06_DESIGN_SYSTEM.md`, and `.planning/VISUAL_DIRECTION.md`: the classroom remains canvas-first and high contrast; warm-neutral surfaces and contained color fields may support product state but never replace it or sit over the drawable board. Interactive chrome uses Tactile UI System physics on Syncvas tokens — raised pressable buttons (inset highlight + solid bottom edge + 2px press), inset inputs with lime focus rings, fast 100–160ms motion, no hover scaling or glass/glow.

### Foundation

- [x] **FOUND-01**: Local monorepo health works — Next.js app, Convex health query, and socket-server ping respond; lint/typecheck/test scripts are green
- [x] **FOUND-02**: Convex schema covers sessions, participants, doubts, votes, exports, and AI jobs with indexed query paths
- [x] **FOUND-03**: Shared Socket.IO protocol package defines versioned, validated payloads for board and viewport events usable by app and socket-server

### Room Lifecycle

- [ ] **ROOM-01**: Authenticated teacher can create a live classroom session
- [ ] **ROOM-02**: Session exposes a unique short join code and QR that both open the same room
- [ ] **ROOM-03**: Students can join a live session without accounts
- [ ] **ROOM-04**: Teacher can end a session; ended sessions reject new joins
- [ ] **ROOM-05**: Teacher sees live student/participant count for the active room

### Board Sync

- [x] **BOARD-01**: Teacher can draw on an Excalidraw canvas with stylus/XP-Pen in a supported desktop browser
- [x] **BOARD-02**: Teacher strokes appear locally immediately without waiting for network roundtrip
- [x] **BOARD-03**: Connected students receive live board updates from the teacher via Socket.IO
- [x] **BOARD-04**: Late-joining students receive current scene bootstrap without historical event replay
- [x] **BOARD-05**: Students cannot mutate board content (UI and socket enforcement)
- [x] **BOARD-06**: Student pan/zoom is local-only and never moves the teacher camera or other students

### Follow Teacher

- [ ] **FOLLOW-01**: Student can enable Follow Teacher and mirror the teacher's viewport while follow is on
- [ ] **FOLLOW-02**: Student manual pan/zoom exits follow mode locally without affecting others
- [ ] **FOLLOW-03**: Student can return to Follow Teacher after free-roam
- [ ] **FOLLOW-04**: Viewport packet loss does not corrupt board content

### Doubts

- [ ] **DOUBT-01**: Student can submit a doubt that appears anonymous in the teacher UI
- [ ] **DOUBT-02**: Backend assigns a pseudonymous participant/session ID used for abuse controls
- [ ] **DOUBT-03**: Repeated spam submissions hit rate limits without requiring an AI call
- [ ] **DOUBT-04**: Teacher sees a reactive doubt queue and can answer or dismiss items
- [ ] **DOUBT-05**: A participant can cast at most one same-doubt vote per doubt

### Moderation

- [ ] **MOD-01**: Deterministic profanity/noise rules filter submissions before any AI call
- [ ] **MOD-02**: AI relevance triage runs through a provider-agnostic adapter (no hardcoded LLM provider in feature code)
- [ ] **MOD-03**: Uncertain or failed AI classification falls back without silently dropping a plausible doubt
- [ ] **MOD-04**: System can suggest duplicates for similar doubts

### Persistence & Export

- [ ] **EXPORT-01**: Ending class persists the final board scene as durable state
- [ ] **EXPORT-02**: Teacher can export the final board as image and/or PDF with visible export job state
- [ ] **EXPORT-03**: Teacher can open a class history page listing past classes
- [ ] **EXPORT-04**: Failure of optional AI summary does not lose the persisted board

### Reconnect & UX

- [ ] **UX-01**: Refresh/reconnect restores the latest board for teacher and students
- [ ] **UX-02**: Key flows show error toasts and empty states (join failures, empty queue, empty history)

### Prepared Boards

Design reference: `.design/prepared-boards-and-quizzes.html`

- [ ] **PREP-01**: Teacher can save the current board as a named, reusable template they own
- [ ] **PREP-02**: Teacher can list, open, rename and delete their own templates; another teacher's templates are not readable
- [ ] **PREP-03**: Teacher can start a session from a template so the class opens with that scene already on the board
- [ ] **PREP-04**: Students joining a template-started session receive the prepared scene through the existing `board:current` bootstrap with no student-side change
- [ ] **PREP-05**: Every element of a prepared board stays movable and editable by the teacher during class

### AI Board Authoring

- [ ] **AIB-01**: Teacher can describe a lesson topic and receive a generated draft board to accept, edit, or discard
- [ ] **AIB-02**: Generation runs through a provider-agnostic adapter with server-only credentials; an unconfigured provider degrades to a clear unavailable state rather than an error
- [ ] **AIB-03**: Generated content is emitted as checkable source (mermaid diagram source and structured question data), never as raw Excalidraw element JSON
- [ ] **AIB-04**: Element placement is computed by a deterministic layout function rather than by the model, and requested writing zones contain no elements

### Quiz

- [ ] **QUIZ-01**: Student supplies a display name at join, screened by the existing deterministic moderation filter
- [ ] **QUIZ-02**: Doubts remain anonymous in the teacher UI and never carry the student display name
- [ ] **QUIZ-03**: Teacher can author MCQ and true/false questions for a session and anchor a question to a board position
- [ ] **QUIZ-04**: A hidden question's prompt, options and answer key are absent from every student-facing payload — enforced server-side, not by visual blur
- [ ] **QUIZ-05**: Teacher can reveal a question, making prompt and options available to students and placing it on the board at its anchor
- [ ] **QUIZ-06**: A participant can answer a given question at most once, and answers are graded server-side with the answer key never present in a student projection
- [ ] **QUIZ-07**: A correct answer scores points that decrease with elapsed time down to a floor; an incorrect answer scores zero
- [ ] **QUIZ-08**: Ending a class closes any open question, and a class that ran no quiz still finalizes normally

### Leaderboard

- [ ] **LEAD-01**: Score is maintained per answer in constant time; the leaderboard is an indexed read rather than a scan over all answers
- [ ] **LEAD-02**: Student can open a leaderboard at any time and see their own standing
- [ ] **LEAD-03**: Teacher can project a per-question and a cumulative leaderboard
- [ ] **LEAD-04**: Teacher can lock the room into full-screen quiz mode; students lose canvas interaction, a student refreshing mid-quiz returns to the quiz, and board-anchored and full-screen questions can both be used within one class
- [ ] **LEAD-05**: The final leaderboard freezes into the ended session, appears in teacher history, and is included in the export path

### MCP Lesson Authoring

Spec `docs/36_MCP_LESSON_AUTHORING.md`. Inbound counterpart to AI Board Authoring: phase 12 is
SyncVas calling a provider, phase 16 is external AI clients calling SyncVas. Both go through
the same authoring core.

- [ ] **MCP-01**: SyncVas exposes a remote MCP server implementing spec `2026-07-28` — stateless, no session header, with a working `server/discover`
- [ ] **MCP-02**: A teacher can connect the server from Claude and from ChatGPT and authorize it against their own account via OAuth 2.1
- [ ] **MCP-03**: An external client can create a lesson draft containing diagram source and quiz questions, and read back what it created
- [ ] **MCP-04**: Every MCP write lands as a draft the teacher reviews; no tool can publish to a live room, reveal a question, or change a running class
- [ ] **MCP-05**: No student data is reachable through any MCP tool — no doubts, participants, answers or leaderboards
- [ ] **MCP-06**: Tokens are scoped to a single teacher and a revoked token stops working immediately

### Security & Hardening

- [ ] **SEC-01**: Student socket clients cannot impersonate teacher by spoofing client role fields
- [ ] **SEC-02**: Convex public mutations enforce session ownership/authorization where relevant
- [ ] **SEC-03**: Cross-room socket leakage is prevented; secrets are absent from the browser bundle
- [ ] **SEC-04**: Automated permission-boundary tests cover teacher vs student capabilities
- [ ] **LOAD-01**: One teacher + 100 viewer smoke/load test completed with documented results

## v1.1 Requirements

Milestone v1.1 — Board Grammars. **Complete, not started.** Phase 17 does not begin until v1.0
is complete: every P0 acceptance test holding in 1 teacher + 2 student tabs, the UAT/deploy
items in STATE.md closed, and phases 11–16 delivered.

Design reference: `.design/dsl-catalog.html` (18-grammar catalog, compile targets, rationale).

### Block primitive & transport

- [x] **BLOCK-01**: Teacher-authored binary files (images) reach students over the socket board path
- [x] **BLOCK-02**: Teacher can open a block panel, type a grammar source, and render it onto the board
- [x] **BLOCK-03**: Compiled block output is ordinary Excalidraw content — it syncs, persists in the final snapshot, and exports through existing paths
- [x] **BLOCK-04**: Block source and options persist on the element so a block can be reopened, edited, and re-rendered
- [x] **BLOCK-05**: A compiler registry maps a grammar id to a pure compiler; an unknown grammar or a parse failure surfaces a visible error without mutating the board
- [x] **BLOCK-06**: Block compilation is bounded — source length, emitted element count, and scene/file byte budget are enforced before any socket emit

### Grammars — first set

- [x] **GRAM-01**: `/mermaid` renders flowchart, sequence, class, ER and state as native editable shapes, and other mermaid types as an image
- [x] **GRAM-02**: `/code` renders syntax-highlighted code with a fixed six-theme set and per-block language selection
- [x] **GRAM-03**: `/code` supports line numbers, focus ranges, and diff mode
- [x] **GRAM-04**: `/math` renders LaTeX display equations and aligned derivations

### Teaching mechanics

- [x] **TEACH-01**: A block discloses in author-defined chunks under teacher control (step reveal)
- [x] **TEACH-02**: Teacher can save a block to a snippet library and re-insert it in one action
- [x] **TEACH-03**: Teacher can highlight a line or region and connected students see it, as an ephemeral event that never bumps board version
- [x] **TEACH-04**: Block theme defaults to the current board theme and can be overridden per block

### Grammars — CS teaching set

- [x] **GRAM-05**: `/ds` renders array, linked list, stack/queue, tree, graph, and hash table structures
- [x] **GRAM-06**: `/calltree` renders a recursion tree with repeated subcalls visually marked
- [x] **GRAM-09**: `/plot` renders complexity-growth curves and named function plots
- [x] **GRAM-10**: `/dp` and `/trace` render step tables with a declared fill order

### Grammars — AI/ML set

- [x] **GRAM-07**: `/tensor` renders a shape pipeline with derived output shapes per layer
- [x] **GRAM-08**: `/nn` renders a layer stack with derived parameter counts

## v1.2 Requirements

Course-specific grammars. Each is small once the block primitive exists; build on request
rather than speculatively.

- [x] **GRAM-11**: `/dfa`, `/nfa`, `/tm` — automata and regex→NFA
- [x] **GRAM-12**: `/mem` — stack/heap pointer diagrams
- [x] **GRAM-13**: `/bits` — labelled bit fields, two's complement, IEEE-754, packet layout
- [x] **GRAM-14**: `/confusion` — confusion matrix with derived precision/recall/F1
- [x] **GRAM-15**: `/truth`, `/kmap`, `/circuit` — digital logic
- [x] **GRAM-16**: `/sched`, `/matrix`, `/table` — scheduling gantts, matrix dimension checking, comparison tables

## v1.3 Requirements — AI Lesson Studio & MCP Interop

Design contract: `docs/38_AI_LESSON_STUDIO_AND_MCP.md`. Both the in-app AI adapter and remote ChatGPT/Claude MCP callers use the same authoring service.

- [ ] **AI-LESSON-01**: In-app AI and MCP create the same validated teacher-owned `LessonDraft`.
- [ ] **AI-LESSON-02**: Drafts contain ordered lesson parts, grammar source, explanations, writing zones, and structured MCQ/true-false quiz data.
- [ ] **AI-LESSON-03**: Model output containing Excalidraw elements, coordinates, teacher identity, student data, socket payloads, or live-room commands is rejected.
- [ ] **AI-LESSON-04**: Teacher review, edit, publish, and discard are explicit; generation never writes directly to a live room.
- [ ] **AI-LESSON-05**: Long generation uses resumable bounded parts with idempotency; retrying a part does not duplicate content.
- [ ] **AI-LESSON-06**: Student projections omit answer keys and all teacher-only draft metadata; quiz grading remains server-side.
- [ ] **AI-LESSON-07**: Remote MCP exposes Streamable HTTP, protected-resource metadata, OAuth 2.1 + PKCE, scoped grants, revocation, rate limits, sanitized errors, and no-store responses.
- [ ] **AI-LESSON-08**: A Connections UI lists ChatGPT/Claude grants and supports immediate revoke; tool inventory tests prove no live-room or student-data access.

## v2 Requirements

Deferred to future release. Tracked but not in current executable roadmap.

### Product (former P2)

- **BOOK-01**: Board bookmarks during/after class
- **SNAP-01**: Periodic board snapshots as a product feature beyond finalize
- **REWIND-01**: Rewind / timeline playback of the board
- **PULSE-01**: Confusion pulse (“I’m confused”) signal
- **NOTES-01**: AI-generated structured lecture notes / summary pipeline as a product feature
- **CLUSTER-01**: Question clustering using embeddings
- **ANALYTICS-01**: Teacher analytics dashboards

### Explicitly deferred platform

- **MULTI-01**: Multi-writer canvas / simultaneous student drawing
- **ANNOT-01**: Student annotations on the shared board
- **HWR-01**: Handwriting recognition on the live stroke path
- **AV-01**: Audio transcription and video conferencing
- **ATTEND-01**: Attendance verification
- **BILL-01**: Paid plans
- **TENANT-01**: Organization/college tenant administration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Student cursors | Explicit MVP non-goal; noise and scope |
| In-class chat | Explicit MVP non-goal; doubts cover shy Q&A |
| Yjs / CRDTs | Teacher-only writer; unnecessary complexity |
| Raw HF pen events in Convex | Cost/perf; Socket.IO ephemeral path only |
| LMS replacement | Not the product |
| Public social feed | Not the product |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete — verify green 2026-09-04 |
| FOUND-02 | Phase 1 | Complete — v1 schema + indexes 2026-09-04 |
| FOUND-03 | Phase 1 | Complete — shared board/viewport protocol 2026-09-04 |
| BOARD-01 | Phase 2 | Done |
| BOARD-02 | Phase 2 | Done |
| BOARD-03 | Phase 2 | Done |
| BOARD-04 | Phase 2 | Done |
| BOARD-05 | Phase 2 | Done |
| BOARD-06 | Phase 2 | Done |
| ROOM-01 | Phase 3 | Pending |
| ROOM-02 | Phase 3 | Pending |
| ROOM-03 | Phase 3 | Pending |
| ROOM-04 | Phase 3 | Pending |
| ROOM-05 | Phase 3 | Pending |
| FOLLOW-01 | Phase 4 | Pending |
| FOLLOW-02 | Phase 4 | Pending |
| FOLLOW-03 | Phase 4 | Pending |
| FOLLOW-04 | Phase 4 | Pending |
| DOUBT-01 | Phase 5 | Pending |
| DOUBT-02 | Phase 5 | Pending |
| DOUBT-03 | Phase 5 | Pending |
| DOUBT-04 | Phase 5 | Pending |
| DOUBT-05 | Phase 5 | Pending |
| EXPORT-01 | Phase 6 | Pending |
| MOD-01 | Phase 7 | Pending |
| MOD-02 | Phase 10 | Pending |
| MOD-03 | Phase 7 | Pending |
| MOD-04 | Phase 7 | Pending |
| EXPORT-02 | Phase 8 | Pending |
| EXPORT-03 | Phase 8 | Pending |
| EXPORT-04 | Phase 8 | Pending |
| UX-01 | Phase 8 | Pending |
| UX-02 | Phase 8 | Pending |
| SEC-01 | Phase 9 | Pending |
| SEC-02 | Phase 9 | Pending |
| SEC-03 | Phase 9 | Pending |
| SEC-04 | Phase 9 | Pending |
| LOAD-01 | Phase 9 | Pending |
| PREP-01 | Phase 11 | Not started |
| PREP-02 | Phase 11 | Not started |
| PREP-03 | Phase 11 | Not started |
| PREP-04 | Phase 11 | Not started |
| PREP-05 | Phase 11 | Not started |
| AIB-01 | Phase 12 | Not started |
| AIB-02 | Phase 12 | Not started |
| AIB-03 | Phase 12 | Not started |
| AIB-04 | Phase 12 | Not started |
| QUIZ-01 | Phase 13 | Not started |
| QUIZ-02 | Phase 13 | Not started |
| QUIZ-03 | Phase 13 | Not started |
| QUIZ-04 | Phase 13 | Not started |
| QUIZ-05 | Phase 13 | Not started |
| QUIZ-06 | Phase 13 | Not started |
| QUIZ-07 | Phase 14 | Not started |
| LEAD-01 | Phase 14 | Not started |
| LEAD-02 | Phase 14 | Not started |
| LEAD-03 | Phase 14 | Not started |
| LEAD-04 | Phase 14 | Not started |
| QUIZ-08 | Phase 15 | Not started |
| LEAD-05 | Phase 15 | Not started |
| MCP-01 | Phase 16 | Not started |
| MCP-02 | Phase 16 | Not started |
| MCP-03 | Phase 16 | Not started |
| MCP-04 | Phase 16 | Not started |
| MCP-05 | Phase 16 | Not started |
| MCP-06 | Phase 16 | Not started |
| BLOCK-01 | Phase 17 | Complete |
| BLOCK-02 | Phase 17 | Complete |
| BLOCK-03 | Phase 17 | Complete |
| BLOCK-04 | Phase 17 | Complete |
| BLOCK-05 | Phase 17 | Complete |
| BLOCK-06 | Phase 17 | Complete |
| GRAM-01 | Phase 18 | Complete |
| GRAM-02 | Phase 18 | Complete |
| GRAM-03 | Phase 18 | Complete |
| GRAM-04 | Phase 18 | Complete |
| TEACH-01 | Phase 19 | Complete |
| TEACH-02 | Phase 19 | Complete |
| TEACH-03 | Phase 19 | Complete |
| TEACH-04 | Phase 19 | Complete |
| GRAM-05 | Phase 20 | Complete |
| GRAM-06 | Phase 20 | Complete |
| GRAM-09 | Phase 20 | Complete |
| GRAM-10 | Phase 20 | Complete |
| GRAM-07 | Phase 21 | Complete |
| GRAM-08 | Phase 21 | Complete |
| GRAM-11 | Phase 22 | Complete |
| GRAM-12 | Phase 22 | Complete |
| GRAM-13 | Phase 22 | Complete |
| GRAM-14 | Phase 22 | Complete |
| GRAM-15 | Phase 22 | Complete |
| GRAM-16 | Phase 22 | Complete |

| AI-LESSON-01 | Phase 23 | Planned |
| AI-LESSON-02 | Phase 23 | Planned |
| AI-LESSON-03 | Phase 23 | Planned |
| AI-LESSON-04 | Phase 23 | Planned |
| AI-LESSON-05 | Phase 23 | Planned |
| AI-LESSON-06 | Phase 23 | Planned |
| AI-LESSON-07 | Phase 23 | Planned |
| AI-LESSON-08 | Phase 23 | Planned |

**Coverage:**
- v1.0 requirements: 66 total — 38 mapped to phases 1–10, 28 mapped to phases 11–16, unmapped 0 ✓
- v1.1 requirements: 20 total — mapped to phases 17–21, complete ✓
- v1.2 requirements: 6 total — mapped to phase 22, complete ✓
- v1.3 requirements: 8 total — mapped to phase 23, planned
- v2 deferred (not mapped to executable phases): 14

---
*Requirements defined: 2026-09-04*
*Last updated: 2026-09-05 — added Prepared Boards / AI Authoring / Quiz / Leaderboard / MCP Authoring to v1.0 (phases 11–16); Board Grammars renumbered to phases 17–21*
