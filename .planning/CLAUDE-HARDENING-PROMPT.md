# SyncVas — harden, correct, and finish the UX

A previous agent (Codex) implemented phases 11–16: prepared boards, AI board authoring, quiz core,
leaderboards, quiz persistence, and the MCP lesson-authoring server. Your job is to **verify what it
claims, fix what is wrong, harden the security boundaries, and finish the UX.**

Repo: `C:\Users\nithy\Desktop\.website-production\SyncVas` (branch `main`, Windows).

---

## 1. Start here

1. **`.planning/CODEX-HANDOFF.md`** — the previous agent's own account of what it built, what it
   guessed, and where it is weak. Read it first, then **trust nothing in it until you check.** Its
   "complete and verified" list is a claim, not evidence.
2. `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — the contract
3. `docs/33`–`docs/36`, `docs/38` — the specs phases 11–16 were built against
4. `git log` since the handoff — what actually changed

Then run `npm run verify` yourself and record the real result before reading further.

---

## 2. The invariants — audit these specifically

Each of these is a real failure mode, not a checklist item. Verify each by test or by reading the
code path, not by trusting a doc.

1. **Convex is durable truth; Socket.IO is ephemeral.** No pen coordinates, viewport frames, or
   per-stroke data through Convex.
2. **Teacher-only writer.** Students cannot emit board mutations; the writer lease holds.
3. **Doubts stay anonymous.** Quiz display names must not leak into the doubts queue.
4. **Hidden quiz content is withheld server-side.** The student projection must not contain
   `correctIndex`, and must not contain `prompt`/`options` while a question is `hidden`. **Check the
   network response, not the rendered UI.** A CSS blur over broadcast content ships the answer to
   every student.
5. **Grading happens inside the mutation**, never client-side.
6. **MCP is draft-only.** No tool touches a live classroom; no tool reads student data; identity is
   derived from the OAuth grant and never from a tool argument. Verify by sending a tool call with a
   forged identity argument and confirming it is ignored.
7. **Models emit grammar source, never element JSON or coordinates.** `layoutBoard()` does geometry.
8. **The quiz adds zero socket events.**

---

## 3. Work order

### Stage 1 — Verify the handoff
Reproduce every "verified" claim. Produce a short, honest delta: what actually passes, what does not,
what was overstated. Everything after this depends on knowing the real baseline.

Use `/gsd:verify-phase` for goal-backward checks per phase, and `/gsd:code-review` across the diff.

### Stage 2 — Security hardening
Run `/gsd:secure-phase` on phase 16. MCP is the internet-facing attack surface — treat it as the
priority. Compare against the working reference at `C:\Users\nithy\nk`
(`apps/web/lib/bearer-auth.ts`, `apps/web/lib/mcp-execution.ts`, `apps/web/lib/mcp-server.ts`).

Specifically confirm: PKCE, hashed token storage, revocation checked **per request**, scope
enforcement, confirmation gates on destructive tools, per-client and per-tool rate limits,
idempotency receipts, `timingSafeEqual` comparisons, sanitized error bodies that leak no internals,
and a correct `WWW-Authenticate` challenge on 401.

Then confirm `ALLOW_DEV_TEACHER` and `ALLOW_PROOF_SOCKET` are off in the production path.

### Stage 3 — Correctness and bug fixing
Use `/investigate` for anything non-obvious and `/gsd:debug` for anything that survives two attempts.
Root-cause; do not patch symptoms. Close out the known-defect list in `CODEX-HANDOFF.md` and anything
Stage 1 surfaced.

Confirm these three long-standing items are genuinely resolved:
- binary `files` reach students over the socket path (previously dropped at
  `components/board/board-canvas.tsx:317`)
- `triageDoubt` is wired into the doubt pipeline or deliberately removed
- `duplicateOf` is surfaced in the teacher queue UI

### Stage 4 — Test coverage
Fill every gap named in the handoff, plus anything Stage 1 exposed. The tests that matter most:
the student projection leaks nothing while hidden; a student cannot double-answer or cross-session
answer; scoring at t=0, at the window edge, wrong, and late; `layoutBoard()` never places an element
inside a reserved writing zone (AIB-04); the MCP auth matrix.

### Stage 5 — UX and visual finish
Now do the design work. Codex was instructed to build structurally and invent no visual language,
so this should be polish rather than rework.

`docs/05_UI_UX_SPEC.md` and `docs/06_DESIGN_SYSTEM.md` are the contract; tokens live in
`app/styles/tokens.css`; `.planning/VISUAL_DIRECTION.md` and `.planning/UI-ALIGNMENT-DECISIONS.md`
record decisions already made — follow them rather than relitigating them.

Focus on: real loading/empty/error/disconnected states, the teacher's live-class ergonomics under
time pressure, the student join flow on a phone, leaderboard projection legibility at classroom
distance, and the locked full-screen quiz. Use `/design-review` on the result.

### Stage 6 — End-to-end and sign-off
`/qa` the full walkthrough in one teacher tab and two student tabs: sign in → import prepared board →
start session → students join and name themselves → live strokes → follow mode → anonymous doubts →
reveal a board question → roam and answer → leaderboard updates → locked final quiz → class ends →
board persists → export → reconnect. Then an MCP client authors a draft and the teacher publishes it.

Finish with `npm run verify` green from clean, `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md`
updated to match reality, and `/review` before the final commit.

---

## 4. Rules

- **Never run `/gsd:new-milestone`.** Its step 6 runs `gsd-sdk query phases.clear --confirm`, which
  deletes `.planning/phases/*`. Most of those directories are untracked in git — unrecoverable.
- **Never run `state.milestone-switch`.** It resets STATE.md.
- **Use `/browse` for all web browsing.** The global CLAUDE.md forbids `mcp__claude-in-chrome__*`.
- **Check `git status` and stage explicit paths.** The tree carries in-flight work from other
  sessions.
- **Do not put backticks inside Python or shell strings** — command substitution has corrupted
  planning files in this repo before. Use file-write tools for file content.
- Report honestly. If Codex's work is worse than claimed, say so plainly and fix it; if it is solid,
  say that too.

---

## 5. Definition of done

Every phase 11–16 requirement is backed by a test that would fail if the requirement broke; the MCP
surface passes a security audit; the full classroom flow works in a real browser with two students;
the UI is finished rather than merely functional; and `npm run verify` is green from a clean state.
