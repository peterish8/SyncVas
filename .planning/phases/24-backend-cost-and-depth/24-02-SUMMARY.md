# Phase 24 plan 02 summary — COST-03

Implementation complete. Duplicate doubt detection is indexed and unbounded in time, and a
duplicate no longer pays for a second moderation call.

**Schema** — `doubts.by_session_normalized: ["sessionId", "normalizedText"]`. Deployed live
and confirmed by `convex dev`: `[+] doubts.by_session_normalized`.

**Detection** — `doubts.submit` replaces the `take(100)` scan over all recent doubts with an
indexed lookup on the exact normalized text. The remaining `take(DUPLICATE_LOOKBACK)` (10) is
over rows with *identical* text, so it caps a pathological run of one rejected phrase rather
than capping how far back detection reaches. A duplicate older than 100 submissions is now
found; previously it was silently missed and the teacher saw the same question twice.

**Verdict reuse** — `inheritedVerdict()` copies the triage outcome from the original and
skips scheduling `triageDoubt`. It reuses the verdict, not the lifecycle: an original the
teacher already answered means "this passed triage", so the copy enters the queue as
`accepted` rather than as `answered` — a fresh asker is still waiting. A `screening` or
`rejected` original carries no reusable verdict, so those are triaged normally.

Deterministic screening still runs first and unchanged, so a rejected doubt costs one
screening call and no reads.

**Observed while testing, not changed:** `moderation.applyTriage` only writes `reasonCode`
when the verdict changes the status, so a provider "accept" confirming an already-accepted
doubt leaves the row without one. That is existing behaviour and arguably right — there is
nothing to explain when nothing changed — but it means an inherited `reasonCode` is only
observable on the uncertain path. The tests assert it there rather than pretending otherwise.

Verification: `npm run verify` green — lint 0 errors, typecheck clean, 291 root tests and 17
socket-server tests pass, production build succeeds. Test count rose 285 → 291. New coverage
in `tests/moderation.test.ts`: no second provider call for a repeat, uncertain inherited as
uncertain, an answered original re-entering as accepted, detection past the old 100-row
window, no inheritance from a rejected original, and a read-shape assertion that no query
returns more than 10 rows however busy the room is.
