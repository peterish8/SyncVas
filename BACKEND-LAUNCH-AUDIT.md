# SyncVas backend launch audit

**Date:** 2026-09-08
**Scope:** Convex functions, Socket.IO relay, wire protocol, AI adapters, deploy/runtime config.
**Method:** source read of every file under `convex/`, `socket-server/src/`, `shared/`, `lib/ai/`, `lib/production-env.ts`, `next.config.ts`, plus a full local verification run.

**Verification run (this machine, today):**

| Check | Result |
| --- | --- |
| `npx vitest run` | 291 passed / 22 files |
| `npm --prefix socket-server run test` | 17 passed / 3 files |
| `npm run typecheck` | clean (root + socket-server) |

The September 5 review is stale. Of its eleven P0/P1 items, nine are closed in the current tree: the writer lease, per-event token expiry, viewport caching in `board:current`, bounded scene/file schemas, participant block re-check at token issuance, hot-state sweeping, snapshot persistence, and socket revocation all exist and are tested. This audit supersedes it.

The remaining gap is not foundations. It is a small number of paths that behave differently in a production deployment than they do locally, plus three product surfaces that are wired into the UI but not actually implemented on the backend.

---

## Status

**Wave 1 is complete** (P0 1, 2, 3 and P2 17 closed — see "Wave 1 — deploy correctness" below).

**An architecture pass has also landed** on top of it, from `architecture-review-20260908`:

- The `*AsLocalTeacher` twin family is gone. 30 twins removed across 9 Convex modules; the dev identity now resolves once inside `permissions.requireTeacher`. Public Convex functions: **83 → 53**. This also closed a live defect — the doubts-queue twins had silently diverged and returned different rows.
- The local-teacher gate is declared once again in `lib/teacher-access.ts` instead of being re-derived in seven surfaces.
- Dead modules deleted: the empty `attachRoomHandlers` stub, the duplicate `roomName` definition, `lib/ai/providers/index.ts` (a one-adapter seam whose only caller was a test), and the two dead params plus the `returnToTeacher` alias in `use-teacher-viewport`.
- `shared/types/session.ts` is imported rather than orphaned beside two copies of its union.
- `requireLiveClaims` in the relay now returns claims the callers use, instead of all four re-calling `getClaims` behind an unreachable null check (P2 was silent on this; it is the DEPTH-01 smell made concrete).
- New: `tests/permissions-seam.test.ts` — 15 cases at the permissions interface, which had never been tested through its own seam. `tests/teacher-access-gate.test.ts` shrank from an 89-line source lint to three regression assertions.

`npm run verify` is green: 0 lint errors (2 pre-existing warnings), typecheck clean, **321 root tests + 17 socket tests**, production build succeeds.

Still open: **P0 4** (the export stub) and everything in P1/P2. Two architecture candidates were deliberately left: restructuring the 751-line board canvas (the live-classroom hot path, no test coverage — needs its own session), and the export seam (blocked on the same product decision as P0 4).

---

## P0 — will break a real class

### 1. Every user-facing error code is redacted in production — **FIXED**

`convex/` throws `new Error("CODE: message")` in 62 places and `ConvexError` in 8. Convex delivers `ConvexError.data` to the client verbatim, but for any other exception a **production** deployment replaces the message with `Server Error` (dev deployments pass it through, which is why this has never been seen).

`lib/user-facing-errors.ts:95` parses `error.message` for a leading `CODE:`. Against `Server Error` every entry in the `KNOWN` table misses and every call returns the generic fallback.

Concretely, on the deployed site: a student entering a wrong join code, a student hitting the doubt rate limit, a student joining an ended class, a teacher whose board exceeds the snapshot bound, and every quiz validation error all render as *"Something went wrong. Try again."* `docs/28_ERROR_CODES.md`, the UX contract, and `tests/user-facing-errors.test.ts` all describe behavior that only holds locally.

Affected files: `sessions.ts`, `participants.ts`, `doubts.ts`, `quiz.ts`, `boardSnapshots.ts`, `boardAssets.ts`, `boardTemplates.ts`, `boardAuthoring.ts`, `exports.ts`, `summaries.ts`, `authBootstrap.ts`.

### 2. A session can be permanently stuck in `ending` — **FIXED**

`sessions.end` patches status to `ending`, schedules `internal/revokeRoom` (which evicts every live socket and clears hot state), and schedules `sessions.finalize`. `finalize` refuses to complete without `latestSnapshotId`:

```ts
if (!session.latestSnapshotId) {
  return { sessionId: session._id, ok: false as const, reason: "FINAL_SNAPSHOT_MISSING" as const };
}
```

Nothing retries. Nothing times out. `end` early-returns when status is already `ending`, so pressing End again is a no-op. Exports and summaries both require `status === "ended"`. The sockets are already gone, so the board cannot be re-saved from the relay.

The room is unrecoverable, and the class's board is lost.

Reachable whenever the snapshot save does not land before `end`: the teacher closes the tab between save and end, the scene exceeds `MAX_SCENE_JSON_BYTES` (900 KB) and `validateSceneJson` throws, or the save request drops on a flaky connection. The client (`components/room/teacher-session-controls.tsx:206-217`) awaits `onBeforeEnd` first, which narrows the window but does not close it — and any failure after that point leaves no path back.

### 3. `doubts.listOpen` has no authorization — **FIXED**

```ts
export const listOpen = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "live") return [];
```

No participant check, no ownership check. Any caller holding a session ID reads the text of every open doubt in a live room. `submit`, `vote`, and `quiz.listForStudent` all verify the participant belongs to the session; this one does not. Student-written text in a product whose central privacy promise is doubt anonymity.

### 4. The export pipeline is a placeholder wired to a shipped UI

`convex/internal/exportJobs.ts:processNext` never reads `job.type`. For `board-pdf`, `notes-pdf`, and `png` alike it produces one hardcoded SVG containing the first 10,000 characters of the raw scene JSON as literal `<text>`, stores it, and marks the job `ready`.

`components/export/export-actions.tsx` and `export-status.tsx` present this as a working feature and report success. A teacher who exports a class gets a file that is not a PDF, not a PNG, and not their board.

---

## P1 — fix before a real pilot

### 5. The relay is hard single-instance and nothing enforces it

`activeTeacherWriters` (`server.ts`), the hot scene and revoked-room maps (`board-hot-state.ts`), and per-socket rate state (`rate-limit.ts`) are all process memory. There is no Socket.IO Redis adapter.

At two replicas: the teacher writer lease stops working (two teacher sockets, one per instance, both admitted), students land on different instances and see different boards, `board:current` returns empty for anyone whose instance never saw an update, and `/internal/revoke-room` evicts only the instance the request happened to reach.

Nothing in `Dockerfile`, `config.ts`, or `docs/20_DEPLOYMENT_ENVIRONMENT.md` states this constraint. It is one autoscale setting away from silent, hard-to-diagnose classroom corruption.

### 6. Tokenless sockets are admitted without limit

```ts
io.use((socket, next) => {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (auth?.token === undefined) return next();
```

Deliberate, for health probing — but there is no per-IP connection cap, no global socket cap, and no idle disconnect for a socket that never joins a room. `LIMITS.maxSocketsPerRoom` guards admitted students only. Anyone can hold open as many tokenless sockets as the process has file descriptors.

### 7. `room:join` and `foundation:ping` are unrated, and `room:join` amplifies

`board:update` and `board:request-current` go through `allowAction`. `room:join` does not — and each accepted call runs `emitPresence`, a broadcast to every socket in the room. One admitted student issuing `room:join` in a loop turns a small frame into an N-socket fan-out, up to 400x. `foundation:ping` is likewise unrated (1:1, so lower impact).

### 8. No error tracking, no backend telemetry

`SENTRY_DSN` appears in `.env.example` under "Optional observability" and is read by nothing in the repo. There are zero `console.*` calls in `convex/`. The relay logs startup, shutdown, and crashes only — `debugLog` is off unless `SOCKET_DEBUG_EVENTS=1`, and it is correctly off by default because it fires at stroke rate.

On launch day, the first signal that anything is wrong is a teacher telling you. `docs/19_OBSERVABILITY_ANALYTICS.md` describes a system that does not exist yet.

### 9. CSP is report-only with nowhere to report

`next.config.ts` ships `Content-Security-Policy-Report-Only` with an explicit plan: watch for violations on a full classroom run, then set `CSP_ENFORCE=1`. But the policy carries no `report-uri` and no `report-to` directive, so violations are written to each individual visitor's browser console and reach no one. There is no way to complete the plan as written.

### 10. Socket revocation failures are dropped silently

`internal/revokeRoom.run` returns `SOCKET_REVOCATION_UNAVAILABLE` on a fetch failure and `SOCKET_REVOCATION_REJECTED` on a non-2xx. The comment says "a later retry can safely call the idempotent endpoint" — there is no later retry. If the relay is restarting or briefly unreachable during End Class, the room is never evicted and live sockets keep broadcasting the board for up to the remaining token TTL (5 minutes) after the class ended.

### 11. Hot state holds abandoned rooms for six hours with no room cap

`LIMITS.hotRoomIdleMs` is 6 hours and there is no ceiling on the number of rooms in the map. A room reaches `clearHotScene` only through explicit revocation; a teacher who closes the tab never triggers it. Worst case per room is roughly 2.9 MB (900 KB scene + 2 MB files). Five hundred abandoned rooms is about 1.4 GB held on a single-instance process for a period far longer than any class.

### 12. Nothing preflights the Convex deployment environment

`lib/production-env.ts` is genuinely good, but it runs inside `next build` and can only see Next's environment. `SOCKET_INTERNAL_SECRET`, `AI_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AUTH_GOOGLE_ID`/`SECRET`, `SITE_URL`, and `SOCKET_SERVICE_INTERNAL_URL` all have to be set separately on the Convex deployment, where nothing checks them. A missing `SOCKET_INTERNAL_SECRET` there means `issueSocketToken` throws on every join while the site itself looks healthy.

The dev-teacher escape hatch does fail closed — `isLocalDevTeacherAllowed` requires both `NODE_ENV === "development"` and `ALLOW_DEV_TEACHER === "1"`, and Convex production does not set `NODE_ENV=development`. That single line is the only thing standing between the open internet and a teacher identity, so it deserves an explicit deployed assertion rather than a reasoned argument.

---

## P2 — real, not blocking

13. **`participants.getParticipantForSession` has no authorization.** Any participant ID returns its session ID. Low value to an attacker, but it is the one remaining unchecked read.
14. **No GC for orphaned uploads.** `boardAssets.generateUploadUrl` can be called repeatedly; a blob uploaded and never passed to `register` is never referenced and never deleted. Storage cost grows silently.
15. **No retention or deletion policy at all.** There is no `convex/crons.ts`. Doubts, participant hashes, quiz answers, moderation events, snapshots, and storage blobs accumulate indefinitely, and there is no "delete this class" mutation. For a product used by schools this is a compliance gap (DPDP in India, GDPR elsewhere) as much as a cost one.
16. **No rate limits on authenticated teacher writes.** `sessions.create`, `boardTemplates.save`, and `boardAuthoring` are unbounded per teacher.
17. **`convex/internal/finalizeBoard.ts` is dead code** duplicating `sessions.finalize`. Two implementations of finalization is exactly how the snapshot logic drifts.
18. **Final snapshots do not carry board images.** `saveFinal` persists scene JSON only. `boardAssets` is a parallel table with a `listForExport` internal query that nothing calls. A board with images replays and exports without them.
19. **`_scaffoldPing` is still a public query** in `sessions.ts` and `moderation.ts`.
20. **`participantId` is an undocumented bearer capability.** It is unguessable and this is a reasonable design for anonymous join, but nothing in the docs says so, and the next person to touch `doubts.vote` will assume it is authenticated.

---

## Plan

Each wave ends with `npm run verify` green. Items are ordered so nothing later depends on something earlier being redone.

### Wave 1 — deploy correctness (P0 1, 2, 3) — DONE

**What shipped**

- `convex/errors.ts` — `fail(code, message)` throwing `ConvexError({ code, message })`, matching the payload `permissions.ts` already used, plus `rethrowCoded()` for the `shared/` validators (which stay Convex-free because the relay type-checks them).
- All 62 `throw new Error("CODE: …")` sites migrated across eleven Convex modules. The one remaining plain throw, in `internal/exportJobs.ts`, is caught in the same function and never reaches a client; it carries a comment saying so.
- `lib/user-facing-errors.ts` reads `error.data.code` first and matches on the code, falling back to message parsing so the relay's `protocol:error` frames keep working. `teacher-session-controls.tsx` now matches codes instead of message substrings.
- `sessions.finalize` retries five times at 6 s, then ends the room anyway with `finalizeWarning: "FINAL_SNAPSHOT_MISSING"` (new optional field on `sessions`). The room always terminates.
- `sessions.saveFinalAndEnd` / `…AsLocalTeacher` — snapshot write and status change in one transaction; `boardSnapshots.save` exported as `saveFinalSnapshot` to make that possible. The teacher page calls it through a renamed `onEndSession` prop; `TeacherSessionControls` falls back to the plain `end` mutation when no handler is wired.
- `permissions.requireParticipantInSession` — one shared admission check (room match + block state), now used by `doubts.listOpen`, `doubts.submit`, `doubts.vote`, and `quiz`. `listOpen` takes a `participantId`; `StudentDoubtComposer` reads it via `useStoredValue`.
- Deleted `convex/internal/finalizeBoard.ts` (P2 17).

**Tests added:** four in `user-facing-errors.test.ts` for production-shaped `ConvexError` delivery, four in `final-board.test.ts` for atomic save-and-end, three in `doubts-permissions.test.ts` for list admission, and the finalization tests in `final-board.test.ts` / `export-history-reconnect.test.ts` were rewritten — they had encoded the stuck-in-`ending` bug as intended behaviour.

**Not yet verified:** the deployed-environment check in the launch gate below. Everything here is proven locally; the production redaction behaviour itself can only be confirmed against a real Convex production deployment.

**1.1 Move every client-facing throw to `ConvexError`.**
Add `convex/errors.ts` exporting `fail(code, message): never` that throws `new ConvexError({ code, message })`. Replace `sessions.ts`'s local `fail` and the 62 `throw new Error("CODE: ...")` sites. Extend `lib/user-facing-errors.ts` to read `error.data.code` first and fall back to message parsing for the relay's `protocol:error` payloads, which are a separate transport and stay as they are. Add a test asserting the mapper works on a `ConvexError`-shaped object with no usable `message`.

**1.2 Make End Class terminal.**
Three changes, all in `convex/sessions.ts`:
- `finalize` schedules a bounded retry of itself (say 5 attempts over ~30s) instead of returning `ok:false` once.
- After the retries, transition to `ended` anyway and record `endedAt` plus a `finalizeWarning` field on the session, so the class closes and the teacher is told the board could not be saved rather than losing the room.
- Add `sessions.saveFinalAndEnd` — one mutation taking `sceneJson` that writes the snapshot and patches to `ending` in a single transaction, and point the client at it. This removes the save/end window rather than narrowing it.

Then delete `convex/internal/finalizeBoard.ts` (P2 17) so one implementation remains.
Test: end with no snapshot, end with an oversized scene, end twice concurrently.

**1.3 Authorize `doubts.listOpen`.**
Take `participantId` and reuse the `participantInSession` check `quiz.ts:424` already implements — lift it into `convex/permissions.ts` so both call it. Update `components/doubts/` callers. Test the unauthorized case.

### Wave 2 — the export lie (P0 4)

Pick one and do it properly; do not ship the current stub.

- **Recommended:** render server-side in a Convex action using `@excalidraw/excalidraw`'s `exportToSvg`, then rasterize to PNG and wrap SVG in PDF. Honour `job.type`. Join `boardAssets.listForExport` so images survive (P2 18).
- **Cheaper:** export client-side from the live Excalidraw instance on the teacher's machine and upload the result, keeping the job row for status only.
- **Cheapest honest option:** remove the export UI and the `exports` table from the launch scope, and say so in `docs/03_MVP_SCOPE.md`.

Whichever you pick, `docs/16_PDF_EXPORT_AND_ARCHIVE.md` and the acceptance tests need to match the outcome.

### Wave 3 — relay hardening (P1 5, 6, 7, 10, 11)

- Pin the relay to one instance: assert it in `loadConfig` via an explicit `RELAY_SINGLE_INSTANCE=1` acknowledgement, document it in `docs/20_DEPLOYMENT_ENVIRONMENT.md`, and set replicas to 1 in whatever hosts it. Note the Redis-adapter work as the prerequisite for ever scaling out.
- Add `LIMITS.maxTokenlessSockets`, a per-IP connection cap, and a 30-second timer that disconnects any socket which never joined a room.
- Put `room:join` and `foundation:ping` behind `allowAction`, and debounce `emitPresence` to at most once per second per room.
- Retry `internal/revokeRoom` with backoff via `ctx.scheduler`, and record a failure on the session so it is visible rather than silent.
- Cut `hotRoomIdleMs` to ~90 minutes and add `LIMITS.maxHotRooms` with oldest-first eviction.

### Wave 4 — observability (P1 8, 9, 12)

- Wire Sentry (or equivalent) in three places: the Next app, the relay's `uncaughtException`/`unhandledRejection` handlers, and the catch blocks in Convex actions. Scrub board text, doubt text, and tokens at the SDK's `beforeSend`, matching the AGENTS.md logging rule.
- Add `/api/csp-report` and a `report-uri`/`report-to` directive so report-only mode has a watcher. Run one full class, read the report, then set `CSP_ENFORCE=1`.
- Add a `convex/health.ts` query that asserts the deployment's own env (secret present and >= 32 chars, `NODE_ENV` not `development`, `ALLOW_DEV_TEACHER` unset, AI provider consistent) and returns a problem list in the same shape as `inspectProductionEnv`. Call it from the deploy runbook and fail the deploy on any error.

### Wave 5 — data lifecycle (P2 13, 14, 15, 16, 19, 20)

- Add `convex/crons.ts`: purge sessions ended beyond a stated retention window along with their participants, doubts, votes, moderation events, snapshots, assets, exports, and the storage blobs behind them; sweep unreferenced storage uploads.
- Add a teacher-invoked `sessions.remove` for the same cascade on demand.
- Write the retention window into `docs/17_SECURITY_PRIVACY_ABUSE.md` and into whatever privacy copy the site shows, since schools will ask.
- Authorize `participants.getParticipantForSession`; add per-teacher write rate limits; delete the `_scaffoldPing` queries; document `participantId` as a bearer capability in `docs/13_AUTH_ANONYMITY_PERMISSIONS.md`.

### Launch gate

Beyond the existing exit criteria in `REMEDIATION-PLAN.md`, none of which should be dropped:

- A deployed-environment run confirming a wrong join code shows *"Check the six-character code and try again."* and not *"Something went wrong."* — this is the single check that proves Wave 1.1 landed.
- End Class with the network cut at the moment of save, and confirm the room still reaches `ended`.
- An export opened in a PDF reader and an image viewer.
- One 45-minute class with Sentry attached and zero unhandled errors.
- A CSP report log from a full classroom run, reviewed, before `CSP_ENFORCE=1`.
