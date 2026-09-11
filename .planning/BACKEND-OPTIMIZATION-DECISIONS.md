# Backend cost & depth — decisions (2026-09-07)

Source: architecture review of `convex/`, `socket-server/`, `shared/protocol/`, `lib/ai/`.
Phase: `.planning/phases/24-backend-cost-and-depth/`.

This file holds the measurements and the reasoning so the six plans stay short.

## What was measured

All figures are estimates derived from constants in the code, not from a running
deployment. Assumptions are stated so they can be re-run against real telemetry.

**Class model:** 30 students, 45 minutes, 10 quiz questions, 150 doubt submissions,
one teacher dashboard tab open, typical mid-lesson scene ~150 KB (ceiling is
`MAX_BOARD_SCENE_BYTES = 900_000`).

| Path | Now | After | Ratio |
|---|---|---|---|
| Relay egress while drawing | ~45 MB/s | ~0.6 MB/s | ~50× |
| Relay egress per class (full drawing duty) | ~120 GB | ~1.6 GB | ~75× |
| `getTeacherDashboard` document reads / class | ~450,000 | ~15,000 | ~30× |
| `quiz.listForTeacher` reads / class | ~90,000 | ~3,000 | ~30× |
| `quiz.myStanding` reads / class | ~270,000 | ~300 | ~900× |
| `quiz.submitAnswer` score lookup / class | ~9,000 | ~300 | ~30× |
| `doubts.submit` reads / submission | ~105 | ~6 | ~18× |
| Moderation provider calls / class | 1 per accepted doubt | 1 per distinct question | varies |

## Findings, in cost order

### 1. The relay broadcasts the whole scene on every stroke — COST-01

`publishScene` (`components/board/use-board-sync.ts`) emits the complete scene plus
every attached binary file. `socket-server/src/protocol.ts` re-broadcasts that whole
envelope to every student. `BOARD_UPDATE_MIN_MS` is 50, so the ceiling is 20 full
scenes per second per room.

The scene is serialized four times per event:

1. `JSON.stringify(elements)` for the change fingerprint in `board-canvas.tsx` `onChange`
2. `JSON.stringify(elements)` again in `flushPending`
3. `JSON.stringify` inside Zod's `boundedJsonValue` byte check on the relay
4. Socket.IO's own encode

Every student then Zod-parses the full envelope back.

**Decision:** move to an element patch stream. `docs/11_REALTIME_SOCKET_PROTOCOL.md`
already specifies "scene update representation selected during implementation" and
"Incremental/new scene state + `boardVersion`", so this implements the spec rather
than departing from it. Hot state keeps the authoritative full scene so
`board:request-current` is unchanged for late join, which satisfies docs/21 "Late join".

**Decision:** diff on Excalidraw's own `id` + `version`/`versionNonce` rather than on a
stringified fingerprint, which removes serializations 1 and 2 as a side effect.

### 2. Reactive queries recompute aggregates by collecting child tables — COST-02

`buildTeacherDashboard` (`convex/sessions.ts:298`) collects every participant of up to
100 sessions to produce a count. `doubts.submit` patches `participants.lastSeenAt` on
every submission, which invalidates that query and every other participant-derived
query. One dashboard tab open during a class therefore re-reads thousands of documents
per doubt.

The same shape appears in `getTeacherSession`, `participants.countForSession`, and
`quiz.teacherQuestions` (collects every answer for every question).

**Decision:** keep counters on the parent document, written in the same transaction as
the child — the pattern `quizScores` already uses in `submitAnswer`. This implements
docs/21 "keep reactive queries narrow", which the current code violates.

**Nuance recorded so it is not mis-fixed:** `leaderboardForSession` collecting all
`quizScores` rows for one session is *correct* — ranking needs every row, and a class
leaderboard is bounded by `maxSocketsPerRoom = 400`. The defects are narrower:

- `myStanding` computes the entire leaderboard per student per answer, which is
  O(students²) across a class. It should read one row.
- `submitAnswer` collects every score row in the session and finds one in JavaScript,
  despite a comment claiming the leaderboard is "an indexed read rather than a scan".
  It needs a `by_session_participant` index.

**Status note:** the quiz paths have no `useQuery` caller yet (phases 13–15 UI is not
built). The shape is set but the bill has not started, which is exactly why fixing it
now is cheap.

### 3. Doubt intake scans 100 documents and pays for duplicate triage — COST-03

`doubts.submit` reads the 100 most recent doubts and scans them in JavaScript for a
duplicate, then schedules `triageDoubt` regardless — so a question the module has
already identified as a duplicate still costs a provider call.

**Decision:** index `[sessionId, normalizedText]` and let a duplicate inherit the
verdict already stored on the original. This also removes the accidental 100-document
detection window, which silently drops duplicates in a busy room.

### 4. Two defects found while reading — COST-04

- `block:highlight` in `socket-server/src/protocol.ts` never calls `allowAction`. It is
  the one teacher event with no rate limit.
- The client coalescer floor is 50 ms (20/s) but `LIMITS.boardUpdatePerMinute` is 600
  (10/s). Sustained drawing exceeds the relay's own budget by 2× and earns
  `RATE_LIMITED`.

Both are structural consequences of the copied handler preamble, which is why they are
fixed inside DEPTH-01 rather than as isolated patches.

### 5. The relay's admission preamble is copied per event — DEPTH-01

Four handlers, ~200 of 262 lines, each repeating: `safeParse` → `getClaims` →
`requireLiveClaims` → `getClaims` again → sessionId match → role → rate limit. A
skipped step is a hole rather than a type error, which is how COST-04 happened.

**Decision:** one `onAdmitted(socket, event, schema, {role, budget}, handler)` interface.
The handler receives claims that are already valid, so a new event cannot forget a step.

### 6. Every teacher function is written twice — DEPTH-02

29 of 104 Convex exports are `*AsLocalTeacher` / `getLocal*` copies that differ only in
which permission helper they call, and they are deployed to production gated on an env
var read inside the helper.

**Decision:** resolve the teacher once behind one interface; production Convex Auth and
local-dev become two adapters at one seam.

**Constraint recorded during design:** the two adapters are not symmetric.
`requireLocalDevTeacher` needs a `MutationCtx` because it upserts the dev teacher row,
while queries use the read-only `getLocalDevTeacher`. The interface must therefore be
two entry points, not one — `teacherForQuery(ctx)` may return null, and
`requireTeacherForMutation(ctx)` may create. Collapsing them to a single function would
either put a write in a query or break local dev bootstrap.

### 7. The SVRT1 token format is implemented three times — DEPTH-03

`convex/sessions.ts` (WebCrypto), `socket-server/src/server.ts` (`node:crypto`), and
`lib/socket-token.ts`. Byte compatibility is maintained by discipline.

**This contradicts a standing decision recorded in `CLAUDE.md`**, which states the format
is implemented three times against three crypto APIs. Plan `24-06` is therefore **blocked
pending an explicit ruling** and must not be executed on the strength of this review
alone. The argument for reopening: `shared/protocol/socket.ts` already resolves from
both the Next.js and socket-server builds, which is the constraint that motivated the
split.

## Sequencing

| Wave | Plan | Why here |
|---|---|---|
| 1 | 24-01 COST-02 | Contained to Convex handlers; no protocol change, no client change |
| 1 | 24-02 COST-03 | Independent table, independent index |
| 2 | 24-03 DEPTH-01 + COST-04 | Relay internals only; makes the new event in 24-04 cheap to add |
| 3 | 24-04 COST-01 | Wire format change; wants its own cycle |
| 4 | 24-05 DEPTH-02 | Touches 29 functions across 9 files; run it when nothing else is mid-flight |
| — | 24-06 DEPTH-03 | Blocked on a CLAUDE.md ruling |

24-01 is first despite 24-04 being the larger cost line: it is zero-risk, needs no
deploy coordination, and removes the O(students²) reads before the quiz UI lands.

24-05 does not make 24-01 cheaper, because the N+1 queries already live in shared
private helpers (`buildTeacherDashboard`, `teacherQuestions`, `leaderboardForSession`)
that both twins call. Fixing the helper fixes both.

## Spec alignment

| Plan | Spec | Relationship |
|---|---|---|
| 24-04 | docs/11 `board:update`, docs/21 "Board broadcast strategy", "Late join" | Implements — spec left the representation open |
| 24-01 | docs/21 "keep reactive queries narrow", "indexed queries" | Implements — current code violates it |
| 24-02 | AGENTS.md "avoid unindexed full-table scans", docs/14 cost protection | Implements |
| 24-03 | docs/11 protocol validation, docs/17 abuse controls | Implements |
| 24-05 | AGENTS.md "authorization/ownership checks" | Neutral — same checks, one place |
| 24-06 | `CLAUDE.md` room admission section | **Conflicts** — needs a ruling |

No plan changes a non-negotiable product rule in `AGENTS.md`. No plan introduces a CRDT,
student board mutation, student cursors, or chat.
