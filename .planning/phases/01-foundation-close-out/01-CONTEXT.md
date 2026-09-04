# Phase 1: Foundation Close-out - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Source:** Roadmap + REQUIREMENTS (FOUND-*) + ingested docs (no discuss-phase; YOLO continue)

<domain>
## Phase Boundary

Brownfield scaffold becomes production-shaped for later phases: Convex schema skeleton with indexes for v1 entities, hardened shared Socket.IO protocol types/validators consumed by app + socket-server, and green verify/health smoke paths (Next.js, Convex, socket-server).

This phase does **not** ship Excalidraw UI, room auth UX, follow mode, doubts UI, moderation, or export flows.

</domain>

<decisions>
## Implementation Decisions

### Schema
- **D-01:** Implement Convex schema per `docs/09_CONVEX_DATA_MODEL.md` for v1 tables: users, classes (optional but indexed if present), sessions, participants, doubts, doubtVotes, boardSnapshots, exports, moderationEvents — with documented indexes. Empty `defineSchema({})` is not acceptable exit.
- **D-02:** Prefer file storage IDs for large board scene JSON; do not force full scenes into documents.
- **D-03:** Every production lookup path must have an index; no unindexed full-table scans.

### Protocol
- **D-04:** Keep `SOCKET_PROTOCOL_VERSION = 1` and Zod-validated strict envelopes.
- **D-05:** Extend `shared/protocol` beyond foundation ping/pong to include versioned board/viewport event schemas matching `docs/11_REALTIME_SOCKET_PROTOCOL.md` (event names + payload shapes). Handlers that fully implement rooms can wait for later phases, but types/validators must exist and be imported by app and socket-server.
- **D-06:** Do not add Yjs/CRDT types or student cursor events.

### Verify / health
- **D-07:** `npm run verify` (or documented equivalent) must pass lint + typecheck + tests + build for app and socket-server.
- **D-08:** Existing Convex health query + socket foundation ping/pong remain the local smoke path; fix wiring if broken.

### Claude's Discretion
- Exact Zod schema field optionality where docs say "adjust validators"
- Whether classes table is included now vs stubbed — prefer include if docs list it
- How to share protocol package between workspaces (existing layout)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product / scope
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, plans 01-01..01-03
- `.planning/REQUIREMENTS.md` — FOUND-01, FOUND-02, FOUND-03
- `AGENTS.md` — non-negotiable MVP engineering rules
- `docs/03_MVP_SCOPE.md` — P0/P1 gates (context only; no P1 work here)

### Data / protocol
- `docs/09_CONVEX_DATA_MODEL.md` — target tables + indexes
- `docs/11_REALTIME_SOCKET_PROTOCOL.md` — event envelope, board/viewport events
- `docs/08_SYSTEM_ARCHITECTURE.md` — Convex vs Socket.IO split
- `docs/26_RESEARCH_AND_ARCHITECTURE_DECISIONS.md` — locked stack decisions
- `docs/28_API_AND_EVENT_ERROR_CODES.md` — if present for protocol:error codes

### Existing code
- `convex/schema.ts` — currently empty schema
- `convex/health.ts` — health query pattern
- `shared/protocol/socket.ts` — foundation ping/pong only today
- `socket-server/src/` — socket server consuming protocol
- `package.json` — verify/lint/typecheck/test scripts

</canonical_refs>

<specifics>
## Specific Ideas

- Roadmap plan split is authoritative: 01-01 schema, 01-02 protocol, 01-03 verify/health.
- Brownfield: do not re-scaffold Next.js/Convex/socket-server from zero.
- Success metric for phase: developer can run health checks; verify scripts green; protocol exports board/viewport types; schema has indexed v1 tables.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `convex/health.ts` — pattern for public Convex queries
- `shared/protocol/socket.ts` — Zod + version literal pattern to extend
- `socket-server` vitest health test — pattern for protocol tests
- Root `tests/protocol.test.ts` — protocol unit tests

### Established Patterns
- TypeScript strict; Zod `.strict()` on socket payloads
- npm workspaces with `socket-server` package

### Integration Points
- App imports shared protocol; socket-server imports shared protocol
- Convex schema drives `_generated` types after push/codegen

</code_context>

<deferred>
## Deferred Ideas

- Excalidraw embed and live board handlers → Phase 2
- Teacher auth, join codes, QR → Phase 3
- Viewport follow behavior → Phase 4
- Doubt mutations/UI → Phase 5+
- AI adapter / moderation pipeline → Phase 6
- Export jobs / history pages → Phase 7
- Load test / production deploy → Phase 8
- All v2 items in REQUIREMENTS.md

</deferred>

---

*Phase: 01-foundation-close-out*
*Context gathered: 2026-09-04 via plan-phase (docs-derived)*
