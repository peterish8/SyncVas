# SyncVas production-readiness review

**Review date:** 2026-09-05  
**Scope:** Next/React client, Convex backend, Socket.IO relay, protocol contracts, accessibility, performance, and public landing UI.  
**Method:** source inspection, focused tests, inline Socket.IO probes, contrast calculations, and live visual review of [Sarvam](https://www.sarvam.ai/) and [Vyra](https://www.usevyra.com/).

## Executive decision

SyncVas has a clear MVP boundary and a healthy foundation: teacher-only editing is enforced in the relay, dynamic Excalidraw loading is correctly client-only, Socket.IO envelopes are versioned, and the existing test suite passes. It is not ready for a production classroom until final board persistence, authenticated teacher operation, offline reconciliation, token/session lifecycle, and camera synchronization are closed.

## Priority findings

### P0 — release blockers

1. **Ending a room does not persist the final board.** `convex/sessions.ts:193-200` only changes status and `convex/internal/finalizeBoard.ts:16-21` returns a scaffold result. `convex/boardSnapshots.ts` was also a scaffold. A successful end can therefore produce no recoverable board artifact.
2. **The active teacher path is development identity/proof-token based.** `components/room/teacher-session-controls.tsx:47-51` uses local-teacher mutations and requests `asLocalTeacher:true`; `convex/authBootstrap.ts:13-19` permits that identity when `ALLOW_DEV_TEACHER=1`; `lib/socket-token.ts:9-14` permits proof tokens when `ALLOW_PROOF_SOCKET=1`; `app/api/proof-socket-token/route.ts:34-40` signs caller-supplied room claims when enabled. Verify these flags are disabled in the production deployment and use authenticated teacher mutations/tokens.
3. **Offline teacher edits can be lost during reconnect.** `components/board/board-canvas.tsx:255-265` marks a scene as published before transport is confirmed, while `components/board/use-board-sync.ts:75-82` drops publishes when disconnected and `:126-131` can accept an empty v0 response. A refresh/reconnect can overwrite the only local copy.

### P1 — must close before a live pilot

4. **Two teacher sockets can write the same room.** `socket-server/src/protocol.ts:82-97` checks only increasing versions; it has no active writer lease. Two valid teacher sockets can race and the later scene becomes canonical.
5. **Established sockets are not revoked on token expiry or session end.** `socket-server/src/server.ts:107-114` authenticates only at handshake and `protocol.ts:36-44` trusts stored claims thereafter. `sessions.end` changes Convex status but the relay does not observe it. The client reconnects with the same five-minute token (`use-board-sync.ts:119-124`).
6. **Teacher refresh loses the active room.** `app/teacher/page.tsx:25-30` keeps `liveBoard` only in component state and the controls keep the session only in state (`teacher-session-controls.tsx:53-61`). There is no durable route/session restore.
7. **Ending can leave the controls stuck in `ending`.** `teacher-session-controls.tsx:128-135` stores the mutation result but never subscribes to the session status. The scheduled finalizer can complete while the UI remains stale.
8. **Late students miss a stationary teacher camera.** The camera is emitted only on scroll (`board-canvas.tsx:300-304`); the relay forwards volatile packets without caching (`protocol.ts:169-172`), and `board:current` originally contained only scene/version.
9. **Follow mode copies teacher coordinates directly across different viewports.** `board-canvas.tsx:188-197` applies raw scroll/zoom; the protocol has no teacher bounds/dimensions (`shared/protocol/socket.ts:92-99`). Excalidraw transforms scene coordinates using viewport offsets, so identical scroll values do not guarantee the same visible content.
10. **Dark-mode primary and follow controls can fail contrast.** `globals.css:483-491` used `var(--ink)` as a dark button background while dark `--ink` is near white (`:56-65`), producing near-white on near-white. Follow controls hardcoded `bg-white` (`components/student/follow-controls.tsx:48,56,66`).
11. **Participant token issuance does not re-check block state.** `convex/sessions.ts:301-309` accepts a participant ID and `:331-335` returns only identity/session. `joinByCode` checks blocks (`convex/participants.ts:41-44`), but a previously admitted ID can bypass that check if directly reused.

### P2 / incomplete product paths

12. Before this remediation pass, doubts, votes, history, and exports were explicit scaffolds. They now have code paths, but Convex-backed integration and browser evidence are still pending.
13. Hot state has a clear helper but no production cleanup call (`socket-server/src/board-hot-state.ts:11-25`).
14. `participants.countForSession` and `getParticipantForSession` query by session without a membership/teacher authorization check.
15. Board scene/files use `z.unknown()` (`shared/protocol/socket.ts:45`), so envelope validation is shallow and payload size is unbounded.
16. `app/globals.css` is approximately 74 KB raw / 15.5 KB gzip with overlapping `origin-*`, `landing-*`, and multiple landing-v2 sections. This is maintainability and CSS-download debt rather than the first classroom blocker.

## Changes applied in this pass

- Added a teacher writer lease per live room in `socket-server/src/server.ts`; a second teacher connection receives `WRITER_ALREADY_ACTIVE` and is disconnected.
- Added per-event expiry checks in `socket-server/src/protocol.ts`; expired established tokens receive `TOKEN_EXPIRED`.
- Cached the latest teacher viewport in hot state and included it in `board:current`, so late students can initialize follow mode.
- Preserved unsent teacher scene changes while disconnected and only clears the pending scene after a connected publish in `components/board/board-canvas.tsx`.
- Added bounded, owner-authorized final snapshot mutations in `convex/boardSnapshots.ts` and made finalization refuse to mark a room ended until `latestSnapshotId` exists (`convex/sessions.ts`).
- Wired the teacher page to capture the latest local scene and save it before ending a local-teacher session.
- Implemented anonymous doubts, deterministic rate limiting/noise screening, teacher queue resolution, and one-vote-per-participant semantics in `convex/doubts.ts` with working composer/queue controls.
- Implemented provider-neutral moderation fallback and generic server-only HTTP adapter configuration.
- Implemented export job records, in-process SVG artifact generation, reactive export status, and teacher history queries/UI.
- Added a reproducible one-teacher/100-viewer Socket.IO smoke test and deployment/error-code runbook.
- Replaced the dark-mode primary button contrast hazard with semantic `--primary-bg/--primary-fg` tokens and removed hardcoded white follow-control surfaces.
- Added the v1.1/v1.2 bounded grammar registry, escaped SVG fallback, binary-file transport, step reveal, snippets, and volatile teacher line pointers.

## Performance strategy

Measure in a production build on a mid-range Android phone and a 4-core laptop. Record p50/p95 for first interactive paint, Excalidraw dynamic chunk load, room join-to-board-current, first teacher update-to-student render, and reconnect-to-resync. Track Socket.IO messages/sec, payload bytes, Convex mutation count, long tasks over 50 ms, heap growth during a 45-minute room, and battery/CPU during drawing.

Keep high-frequency pointer data in Excalidraw and the relay only. Coalesce teacher updates at the existing `BOARD_UPDATE_MIN_MS`, cap scene/file payload bytes, reject malformed or oversized envelopes, and persist only debounced snapshots. Use the browser Performance API and Socket.IO counters in a local debug panel, then export JSON traces for comparison. Add a 100-viewer smoke run and a 45-minute soak before launch.

## UI/UX direction

Keep SyncVas's warm neutral canvas, teacher-first hierarchy, and tactile controls. Borrow Sarvam's sparse typography and calm warm-to-cool atmospheric field for the public landing page, and Vyra's bold sans/serif contrast, blue pill CTA, and dark editor preview for the classroom product story. Keep the classroom canvas opaque and evidence-first; reserve blur and glow for contextual chrome. Add visible connection state, a clear “saved locally / syncing / synced” indicator, a reconnect action, keyboard-visible focus, reduced-motion behavior, and a status announcement for follow mode. Use semantic theme tokens everywhere and verify WCAG 2.2 AA contrast for every state.

## Verification status

- Root Vitest: **54 passed, 4 skipped** across 8 files.
- Socket-server Vitest: **3 passed** across 2 files, including the block-highlight schema contract.
- Local Convex UAT: **passed** for create/start, anonymous join, doubt submit/vote/resolve, final snapshot, end-to-ended transition, ended-room rejection, and export job `queued → processing → ready`.
- TypeScript check after the changes: **passed** with `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Full-repo ESLint: **passed** with one pre-existing unused-parameter warning in `lib/ai/moderation-adapter.ts`.
- Next production build: **passed** with `node node_modules/next/dist/bin/next build` (Next 16.3.4/Turbopack).
- Vercel CLI is not installed. Install with `npm i -g vercel` before pulling deployment env, viewing Vercel logs, or deploying.
- Browser/device UAT, hosted deployment behavior, token revocation against a real socket session, final snapshot size limits, and multi-device camera fitting remain to be verified.

## Grammar release decision

The v1.1 Board Grammars and v1.2 course-specific grammars are **conditionally ready** for local release. Source-level security checks found no executable source evaluation or unescaped SVG text path. Hosted Convex/socket UAT, multi-browser acceptance, and XP-Pen hardware remain external gates.
