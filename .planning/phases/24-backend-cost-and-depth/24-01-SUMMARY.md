# Phase 24 plan 01 summary — COST-02

Implementation complete. Reactive Convex queries no longer collect child tables to produce
counts.

**Schema** — `sessions.studentCount`, `quizQuestions.answerCount` / `correctCount` (all
optional, so existing rows stay valid), and a `quizScores.by_session_participant` index.

**Writes** — `participants.joinByCode` increments `studentCount` in the same transaction as
the insert, and only on the insert branch; `quiz.submitAnswer` patches the question tallies
in the same transaction as the answer and resolves the score row through the new index
instead of collecting the room's scores.

**Reads** — `participants.countForSession`, `sessions.getTeacherSession` and
`sessions.buildTeacherDashboard` read the counters. `buildTeacherDashboard` is now one
indexed `take(100)` with no per-session fan-out.

**`myStanding` replaced by `quiz.leaderboardForRoom(sessionId)`.** The old signature took
`participantId`, so every student produced a distinct query-and-args pair and Convex
recomputed the whole leaderboard once per student per answer — O(students²) across a class.
Identical args share one computation; the client finds its own row. Authorization matches
`doubts.listOpen`: gated on the room being live, not on participant membership. Doubt
anonymity is untouched — the doubts queue still carries no display name.

`leaderboardForSession` was deliberately left alone. Collecting a session's score rows is
correct for ranking and is bounded by `maxSocketsPerRoom = 400`.

**Backfill** — `convex/internal/backfillCounts.ts` (`sessions`, `quizQuestions`): bounded,
cursor-resumable, idempotent, recomputed from child rows. Run once per environment after
deploy; not scheduled.

**Test double** — `tests/helpers/fake-convex.ts` gained `paginate` and per-table read
recording (`reads`, `readsOf`, `resetReads`). The read-shape assertions are the point: a
re-introduced collect still returns the right numbers and would pass a value-only test.

Verification: `npm run verify` green — lint 0 errors (3 pre-existing warnings), typecheck
clean, 285 root tests and 17 socket-server tests pass, production build succeeds. Test count
rose 273 → 285. `convex/_generated/api.d.ts` regenerated via `npx convex codegen`.

Not done here, and deliberately: the estimated read reductions in
`.planning/BACKEND-OPTIMIZATION-DECISIONS.md` remain estimates from constants. They are
confirmed structurally (the collects are gone, asserted by test) but not measured against a
live deployment, which is blocked on the same deployment link as the phase 3–8 UAT.
