---
phase: 02-board-proof
plan: 01
subsystem: board-sync
tags: [excalidraw, socket.io, board, read-only, hot-state]

requires:
  - 01-01
  - 01-02
  - 01-03
provides:
  - Teacher Excalidraw canvas with local-first strokes
  - Socket.IO board:update / board:request-current / board:current handlers
  - In-memory latest-scene hot state (no Convex pen stream)
  - Student read-only canvas + local pan/zoom
  - Dev/proof SVRT1 token mint via /api/proof-socket-token
  - board-sync integration tests (5 cases)
affects:
  - 03-room-lifecycle
  - 04-follow-teacher
  - 06-p0-final-board-persistence

tech-stack:
  added:
    - "@excalidraw/excalidraw ^0.18.1 (already depended; now embedded)"
  patterns:
    - SVRT1 auth.token admission (no browser-trusted role)
    - Hot-state latest-only scene; stale version reject
    - applyingRemote guard to avoid echo rebroadcast

key-files:
  created:
    - lib/socket-token.ts
    - app/api/proof-socket-token/route.ts
  modified:
    - socket-server/src/protocol.ts
    - socket-server/src/server.ts
    - socket-server/src/board-hot-state.ts
    - socket-server/src/auth.ts
    - components/board/board-canvas.tsx
    - components/board/use-board-sync.ts
    - components/board/board-room.tsx
    - tests/board-sync.test.ts
    - THIRD_PARTY_NOTICES.md
    - convex/sessions.ts

key-decisions:
  - "Phase 2 proof rooms mint SVRT1 tokens in development; Phase 3 replaces with Convex issueSocketToken"
  - "Student viewport forbidden uses docs code FORBIDDEN (no FORBIDDEN_VIEWPORT in docs/28)"
  - "Adapted WIP canvas patterns; did not restore WIP auth {sessionId,role,proofToken}"

requirements-completed: [BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06]

completed: 2026-09-05
---

# Phase 02 Plan 01: Board Proof Summary

**Teacher Excalidraw strokes broadcast live; students are read-only with local pan/zoom; late join gets latest scene only.**

## What shipped

- Socket classroom handlers: teacher-only `board:update`, `board:request-current` → `board:current`, volatile `teacher:viewport` forward
- Hot state keeps latest `{version, scene}` per session; never writes pointer streams to Convex
- `BoardCanvas` + `useBoardSync` with dynamic Excalidraw, throttle, gap resync, viewMode for students
- Proof token API for `proof-session` demo without full room lifecycle
- Tests: broadcast, student reject, late join, stale version, viewport forbid, cross-room isolation

## Verification

- `npm run typecheck` — pass
- `vitest` board-sync + protocol + room-lifecycle — pass (16 tests)
- XP-Pen hardware sign-off deferred to Phase 9 (per plan)
- Browser two-tab proof: pending in same session after servers up

## Notes

- Teacher/student pages still use `proof-session` until Phase 3 wires real Convex sessions
- `SOCKET_INTERNAL_SECRET` (≥32) required for proof tokens and socket admission
