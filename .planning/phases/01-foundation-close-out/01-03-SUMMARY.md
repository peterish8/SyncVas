---
phase: 01-foundation-close-out
plan: 03
subsystem: infra
tags: [verify, eslint, nextjs, convex-health, socket.io, vitest]

requires:
  - phase: 01-foundation-close-out
    provides: Indexed v1 Convex schema + health query export
  - phase: 01-foundation-close-out
    provides: Versioned SOCKET_EVENTS and foundation ping/pong schemas
provides:
  - Green `npm run verify` (lint + typecheck + test:all + build) for app and socket-server
  - Tracked brownfield foundation health UI + socket-server smoke path
  - Documented Convex live-smoke blocker when anonymous deployment is unreachable
affects:
  - 02-board-proof
  - developer local onboarding

tech-stack:
  added: []
  patterns:
    - Root verify composes lint → typecheck (root + socket-server) → test:all → next build
    - ESLint ignores convex/_generated codegen artifacts
    - Foundation health UI uses api.health.status + SOCKET_EVENTS.foundationPing/Pong

key-files:
  created:
    - package.json
    - eslint.config.mjs
    - app/page.tsx
    - components/foundation/convex-health-status.tsx
    - components/foundation/socket-health-status.tsx
    - socket-server/src/server.ts
    - socket-server/test/health.test.ts
  modified:
    - app/page.tsx
    - eslint.config.mjs
    - .gitignore

key-decisions:
  - "Track previously untracked brownfield verify/health scaffold so FOUND-01 is reproducible in git"
  - "Do not claim live Convex CLI smoke passed — deployment anonymous-agent unreachable from this worktree"
  - "Local npm install required; out-of-tree node_modules junction breaks Next Turbopack"

patterns-established:
  - "Pattern: fix verify regressions with minimal script/code changes; do not re-scaffold toolchain"
  - "Pattern: foundation smoke = Convex status query + socket foundationPing/Pong + Next health components"

requirements-completed: [FOUND-01]

duration: 18min
completed: 2026-09-04
---

# Phase 01 Plan 03: Verify & Health Smoke Summary

**Green monorepo verify pipeline with tracked Next/Convex/socket foundation health responders (live Convex CLI blocked on missing anonymous deployment)**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T14:14:53Z
- **Completed:** 2026-09-04T14:32:36Z
- **Tasks:** 2
- **Files modified:** 22 (Task 1 commit)

## Accomplishments

- Made `npm run verify` exit 0 (lint, root+socket typecheck, root+socket tests, Next build)
- Preserved Convex `health.status` → `{ status: "ready" }` and foundation page mounting both health components
- Confirmed socket-server `health.test.ts` answers versioned `foundationPing` with `foundationPong`
- Documented live Convex CLI smoke failure: `Could not find deployment with name anonymous-agent!` (source query unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Repair verify scripts and clear regressions from schema/protocol** - `56bf01b` (fix)
2. **Task 2: Confirm local Convex + socket health smoke path** - verification-only (no code delta; wiring already correct after Task 1)

**Plan metadata:** (pending docs commit for SUMMARY.md)

## Files Created/Modified

- `package.json` / `package-lock.json` - verify/lint/typecheck/test:all/build scripts tracked
- `eslint.config.mjs` - Next core-web-vitals + ignore `convex/_generated`
- `app/page.tsx` - foundation page with `Link`, `ConvexHealthStatus`, `SocketHealthStatus`
- `components/foundation/convex-health-status.tsx` - `useQuery(api.health.status)`
- `components/foundation/socket-health-status.tsx` - `foundationPing` to `NEXT_PUBLIC_SOCKET_URL` or `http://localhost:4001`
- `socket-server/src/server.ts` + `socket-server/test/health.test.ts` - ping/pong smoke path
- `.gitignore` - ignore env locals, node_modules, tsbuildinfo

## Decisions Made

- Committed the brownfield Next/socket health scaffold that was present on disk but untracked so FOUND-01 is durable across agents
- Treated unreachable `CONVEX_DEPLOYMENT=anonymous:anonymous-agent` as an environment blocker, not a source defect
- Used a real local `npm install` after Turbopack rejected an out-of-tree `node_modules` junction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js lint forbade raw `<a href="/">` on foundation page**
- **Found during:** Task 1 (verify lint)
- **Issue:** `@next/next/no-html-link-for-pages` failed `npm run lint`
- **Fix:** Replaced with `next/link` `Link`
- **Files modified:** `app/page.tsx`
- **Verification:** `npm.cmd run verify` exit 0
- **Committed in:** `56bf01b`

**2. [Rule 3 - Blocking] ESLint warned on Convex codegen unused eslint-disable directives**
- **Found during:** Task 1
- **Issue:** `convex/_generated/*` emitted unused-disable warnings under lint scope
- **Fix:** Added `convex/_generated/**` to ESLint `globalIgnores`
- **Files modified:** `eslint.config.mjs`
- **Verification:** lint clean under verify
- **Committed in:** `56bf01b`

**3. [Rule 2 - Missing critical functionality] Brownfield verify/health files were untracked**
- **Found during:** Task 1
- **Issue:** Only 28 files tracked; `package.json`, app, components, and socket-server health path were untracked so verify was not reproducible from git
- **Fix:** Staged and committed the foundation verify/health scaffold (no new dependencies)
- **Files modified:** package/app/components/socket-server tooling listed above
- **Verification:** `npm.cmd run verify` exit 0 after local install
- **Committed in:** `56bf01b`

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** Necessary for green verify and durable FOUND-01; no scope creep into board/room features

## Issues Encountered

- Out-of-tree `node_modules` junction from main SyncVas caused Turbopack panic (`Symlink ... points out of the filesystem root`); resolved with local `npm install`
- Live Convex smoke: `npx convex run health:status` failed with `Could not find deployment with name anonymous-agent!` because `.env.local` points at an anonymous deployment not available to this agent. Source `convex/health.ts` remains correct; do **not** treat live Convex smoke as passed

## User Setup Required

None for verify scripts. For live Convex CLI smoke on a developer machine: run `npx convex dev` (or link a real deployment) so `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` resolve, then `npx convex run health:status`.

## Next Phase Readiness

- FOUND-01 satisfied for automated verify + socket health; Convex live CLI remains environment-dependent
- Phase 02 board-proof can rely on tracked package scripts and foundation health UI patterns
- No Yjs/cursors/chat/Excalidraw added

## Known Stubs

None — health components wire to real Convex query / socket events (offline copy when socket down is intentional UX, not a stub).

## Threat Flags

None beyond plan threat model (unauthenticated foundation ping remains accepted local liveness).

## Self-Check: PASSED

- FOUND: package.json, convex/health.ts, socket-server/test/health.test.ts, foundation health components, app/page.tsx, 01-03-SUMMARY.md
- FOUND: commit `56bf01b`
- `npm.cmd run verify` exit 0 (re-confirmed after SUMMARY)
