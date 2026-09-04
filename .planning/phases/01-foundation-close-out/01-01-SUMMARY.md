---
phase: 01-foundation-close-out
plan: 01
subsystem: database
tags: [convex, schema, indexes, data-model, codegen]

requires: []
provides:
  - Indexed v1 Convex schema (users, classes, sessions, participants, doubts, doubtVotes, boardSnapshots, exports, moderationEvents)
  - Regenerated Convex DataModel/API types for typed queries/mutations
affects:
  - 01-03-verify-health
  - 03-room-lifecycle
  - 05-doubts-loop
  - 06-p0-final-board-persistence
  - 07-moderation
  - 08-export-history-reconnect-ux

tech-stack:
  added: []
  patterns:
    - Convex defineTable + .index() for every production lookup path
    - Prefer v.id("_storage") for large board scene payloads
    - moderationEvents table stands in for FOUND-02 AI jobs metadata

key-files:
  created:
    - convex/schema.ts
    - convex/_generated/dataModel.d.ts
    - convex/_generated/api.d.ts
    - convex/_generated/api.js
    - convex/_generated/server.d.ts
    - convex/_generated/server.js
    - convex/health.ts
    - convex/tsconfig.json
  modified: []

key-decisions:
  - "Included classes table now (docs/09 + Claude discretion)"
  - "FOUND-02 AI jobs mapped to moderationEvents — no separate aiJobs table"
  - "Modern Convex codegen derives DataModel from schema via DataModelFromSchemaDefinition"

patterns-established:
  - "Schema-only foundation commit before domain mutations"
  - "Storage IDs for large scenes; no HF pen-stream tables/fields"

requirements-completed: [FOUND-02]

duration: 4min
completed: 2026-09-04
---

# Phase 01 Plan 01: Foundation Schema Summary

**Full v1 Convex schema with indexed sessions/participants/doubts/votes/exports/moderationEvents plus storage-backed boardSnapshots**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-04T08:31:08Z
- **Completed:** 2026-09-04T08:35:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Replaced empty `defineSchema({})` with nine v1 tables matching `docs/09_CONVEX_DATA_MODEL.md`
- Declared all documented production indexes (`by_join_code`, `by_session_anonymous`, `by_doubt_participant`, etc.)
- Prefer `_storage` IDs for large board scenes; no Yjs/cursor/HF pen-stream fields
- Ran `npx convex codegen` successfully; health export remains `api.health.status`

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement v1 Convex schema tables and indexes** - `3b40651` (feat)
2. **Task 2: Run Convex codegen/push and confirm generated types** - `b17e68a` (chore)
3. **Rule 3 follow-up: track health + convex tsconfig** - `ef3d25c` (chore)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `convex/schema.ts` - Full v1 defineSchema with tables + indexes
- `convex/_generated/dataModel.d.ts` - Generated DataModel from schema definition
- `convex/_generated/api.d.ts` / `api.js` - Generated API including health
- `convex/_generated/server.d.ts` / `server.js` - Generated server stubs
- `convex/health.ts` - Existing health query tracked for generated API import
- `convex/tsconfig.json` - Convex package TypeScript config

## Decisions Made

- Included `classes` now per docs/09 and CONTEXT Claude discretion
- Used `moderationEvents` for FOUND-02 AI jobs metadata (D-01); did not invent `aiJobs`
- Accepted modern Convex codegen shape: table names live in `schema.ts` and flow into `DataModel` via `DataModelFromSchemaDefinition` (literal table-name strings are not duplicated inside `dataModel.d.ts`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tracked health.ts and convex/tsconfig.json after codegen**
- **Found during:** Task 2 (codegen/types)
- **Issue:** Generated `api.d.ts` imports `../health.js`, but `convex/health.ts` and `convex/tsconfig.json` were still untracked in this worktree history, leaving the committed API incomplete for clones/typecheck.
- **Fix:** Committed the existing brownfield health query and Convex tsconfig without changing behavior.
- **Files modified:** `convex/health.ts`, `convex/tsconfig.json`
- **Verification:** `npx tsc --noEmit -p convex/tsconfig.json` exits 0; `api.d.ts` still exports health
- **Committed in:** `ef3d25c`

**2. [Rule 3 - Blocking] Linked node_modules + .env.local for local anonymous Convex codegen**
- **Found during:** Task 2
- **Issue:** Worktree lacked `node_modules` and `.env.local`; broken AppData `npm` shim; codegen could not run.
- **Fix:** Junctioned `node_modules` and `.convex/local` from the main SyncVas checkout; copied `.env.local` (`CONVEX_DEPLOYMENT=anonymous:anonymous-agent`); used `C:\nvm4w\nodejs\npx.cmd`.
- **Files modified:** local env/junctions only (not committed)
- **Verification:** `npx convex codegen` exited 0
- **Committed in:** n/a (environment only)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Required to complete blocking codegen verification; no schema scope creep.

## Issues Encountered

- Worktree had no installed dependencies; initial `npx convex codegen` hung/timed out until node_modules junction + env were set up
- Modern Convex `_generated/dataModel.d.ts` does not embed table name string literals; verification used schema contents + successful codegen + convex tsc instead of literal `rg` hits for each table name inside `dataModel.d.ts`

## User Setup Required

None - used existing anonymous local Convex deployment from the main project `.env.local`.

## Next Phase Readiness

- Schema foundation ready for 01-02 protocol work and later session/doubt/export mutations
- Do not mark Phase 1 complete until 01-02 and 01-03 (FOUND-02/FOUND-03 verify) pass
- Domain CRUD mutations intentionally deferred (schema-only plan)

## Threat Flags

None beyond plan threat model — no new network endpoints or auth paths; schema-only surface matches T-01-01-* mitigations (no student PII fields; storage IDs for scenes).

## Known Stubs

None — schema defines real tables/indexes; no placeholder CRUD stubs in this plan.

## Self-Check: PASSED

- FOUND: `convex/schema.ts`
- FOUND: `convex/_generated/dataModel.d.ts`
- FOUND: `convex/_generated/api.d.ts`
- FOUND: `convex/health.ts`
- FOUND commits: `3b40651`, `b17e68a`, `ef3d25c`

---
*Phase: 01-foundation-close-out*
*Completed: 2026-09-04*
