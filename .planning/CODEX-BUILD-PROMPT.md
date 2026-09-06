# SyncVas — implement MCP, backend, tests, and functional frontend

You are taking over an in-flight brownfield project. The planning and specs are already written and
are authoritative. Your job is **implementation, tests, and verification** — not redesign, not
re-scaffolding, not re-planning.

Repo: `C:\Users\nithy\Desktop\.website-production\SyncVas` (branch `main`, Windows).

A second agent will follow you to do security hardening and visual/UX polish. **Your job is to make
it correct, complete and tested.** Build the UI structurally, not beautifully — see Stage C.

---

## 1. Read these first, in this order

Do not skip. This project has ~155 uncommitted paths of real work in it. Reading first is how you
avoid rebuilding things that already exist.

**Planning (the contract):**
1. `.planning/PROJECT.md` — product, invariants, key decisions
2. `.planning/ROADMAP.md` — all 23 phases, requirement mapping, per-phase success criteria
3. `.planning/REQUIREMENTS.md` — every requirement ID you must satisfy
4. `.planning/STATE.md` — what is done, what is pending, known blockers
5. `.planning/AI-LESSON-MCP-DECISIONS.md` — locked decisions for the MCP work
6. `.planning/PHASE-COMPLETION-REPORT.md` and `.planning/PHASE-V1.1-V1.2-COMPLETION.md` — what
   previous agents actually shipped

**Specs for the work you are about to do:**
- `docs/33_PREPARED_BOARDS_AND_TEMPLATES.md` (phase 11)
- `docs/34_AI_BOARD_AUTHORING.md` (phase 12)
- `docs/35_QUIZ_AND_LEADERBOARD.md` (phases 13–15)
- `docs/36_MCP_LESSON_AUTHORING.md` (phase 16)
- `docs/38_AI_LESSON_STUDIO_AND_MCP.md` — the shared LessonDraft contract binding 12 and 16

**Existing system you must fit into:**
- `docs/09_CONVEX_DATA_MODEL.md`, `docs/10_CONVEX_BACKEND_SPEC.md`
- `docs/11_REALTIME_SOCKET_PROTOCOL.md`, `docs/13_AUTH_ANONYMITY_PERMISSIONS.md`
- `docs/17_SECURITY_PRIVACY_ABUSE.md`, `docs/18_TESTING_QA.md`, `docs/25_ACCEPTANCE_TESTS.md`
- `docs/24_CODING_STANDARDS.md`, `docs/28_ERROR_CODES.md`

**Working reference implementation — read the actual code if the path is accessible:**
`C:\Users\nithy\nk` (NotesKit) is a production MCP server that works. Copy its security posture
rather than inventing one:
- `apps/web/lib/bearer-auth.ts` — identity resolution, rate limiting, `timingSafeEqual` compare
- `apps/web/lib/mcp-execution.ts` — validate → scope → confirm → rate-limit → idempotency pipeline
- `apps/web/lib/mcp-server.ts` — tool annotations, sanitized errors, `WWW-Authenticate` challenge
- `apps/web/app/.well-known/oauth-protected-resource/api/mcp/route.ts` — resource metadata

---

## 2. Invariants you may not break

Violating any one of these is a rejected change.

1. **Convex is the durable source of truth. Socket.IO is ephemeral transport only.** Never stream
   pen coordinates, viewport frames, or per-stroke data through Convex.
2. **Teacher is the only writer.** Students never emit board mutations. The socket server enforces a
   writer lease (`WRITER_ALREADY_ACTIVE`).
3. **No Yjs/CRDT, no student cursors, no chat.** Permanently out of scope.
4. **Doubts stay anonymous.** Student display names exist for the quiz leaderboard only and must
   never appear in the doubts queue.
5. **Hidden quiz content is withheld server-side.** The student projection must not contain
   `correctIndex`, and must not contain `prompt`/`options` while a question is `hidden`. A CSS blur
   is not security — the scene is broadcast to every student's browser. Grade inside the mutation.
6. **The MCP boundary is draft-only.** Every external write lands as a teacher-reviewable draft. No
   MCP tool touches a live classroom; no MCP tool reads student data. Identity comes from the OAuth
   grant, never from a tool argument.
7. **Models emit grammar source, never Excalidraw element JSON and never coordinates.** A
   deterministic `layoutBoard()` does all geometry.
8. **The quiz adds zero socket events.** Reveal, lock and scoring are low-frequency durable state on
   Convex reactivity. This is deliberate — it also makes mid-quiz refresh work correctly.

---

## 3. Honest current state

- **Phases 1–10 (classroom MVP): implemented locally.** Hosted Convex UAT and multi-browser
  acceptance are **not** done. Local Convex may be an anonymous dev deployment.
- **Phases 17–22 (board grammars): implemented locally, uncommitted.** See `lib/blocks/`,
  `components/blocks/`. Verify they still pass before building on them.
- **Phases 11–16: planned only, no code.** The directories `.planning/phases/11-*` … `16-*` **do not
  exist**. Create them yourself as you work, following the format of `.planning/phases/17-*`.
- **Phase 23: planned, not implemented.** Out of scope for you.

**Known open defects — already diagnosed. Fix them; do not spend time rediscovering them:**

- `components/board/board-canvas.tsx:317` discards binary `files` (`void files`), and `publishScene`
  in `use-board-sync.ts` sends only `{ elements, appState }`. `boardUpdateSchema` already permits an
  optional 2 MB `files` field. **Any image-bearing element renders for the teacher and is blank for
  every student until this is wired.** Fix this early — phases 12 and 16 both produce image content.
- `triageDoubt` is exported and called from nowhere. Wire it into the doubt pipeline or delete it.
  MOD-02/MOD-03 currently exist as a boundary with no path through it.
- `duplicateOf` is computed and returned but no component reads it, so MOD-04 is invisible.

---

## 4. Work order

Sequential. Each stage has a gate — do not start the next until the gate is green. Commit at each
phase boundary with a real message. **Stage explicit paths; never `git add -A`** — the tree contains
in-flight work from other sessions that must not enter your commits.

### Stage A — Backend + MCP

Implement in **this order**, which is not numeric. Phase 12 emits `quiz` grammar blocks that need
`quizQuestions` to already exist, so the quiz data model comes first.

1. **Phase 11** Prepared Boards & Template Library — `boardTemplates` table, CRUD,
   import-into-session
2. **Phase 13** Quiz Core — `quizQuestions` / `quizAnswers` schema, reveal mutation, server-side
   grading, the student projection from §2.5
3. **Phase 14** Leaderboards & Locked Mode — `quizScores` updated with an **O(1) patch inside the
   same transaction as the answer**, read back via a `by_session_points` index. Do not recompute the
   leaderboard from the answers table on each submission; with ~100 students that is O(n) work per
   answer over a growing table.
4. **Phase 15** Quiz Persistence & History — freeze results into class history
5. **Phase 12** AI Board Authoring — `LessonAuthoringService`, the provider adapter under `lib/ai/`,
   and the pure `layoutBoard()`. v1.0 grammar scope is mermaid + text + quiz only.
6. **Phase 16** MCP Lesson Authoring — a stateless MCP server calling the **same**
   `LessonAuthoringService`. OAuth 2.1 + PKCE, hashed tokens, revocation checked per request,
   scopes, confirmation gates, per-client and per-tool rate limits, idempotency receipts, sanitized
   errors. Advertise and test **the protocol versions your installed SDK actually supports** — do
   not hardcode a claim about a `2026-07-28` stateless profile.

Fix the three defects from §3 in this stage. The `files` transport fix goes first.

**Gate A:** `npm run verify` green — that runs lint, typecheck, `vitest run`, socket-server tests,
and `next build`.

### Stage B — Tests

Write tests alongside the code, not afterwards. Existing suites are in `tests/` and
`socket-server/test/`; follow their conventions. `docs/18_TESTING_QA.md` and
`docs/25_ACCEPTANCE_TESTS.md` define what counts as covered.

Minimum new coverage:
- The student quiz projection leaks nothing while hidden — assert on the returned object, not the UI
- A student cannot submit to a hidden question, cannot answer twice, cannot answer another session
- Scoring: correct at t=0 → full points; at the window edge → the floor; wrong → 0; late → rejected
- Leaderboard ordering, and that the score patch is O(1)
- `layoutBoard()`: **no element bounding box intersects a reserved writing zone.** This is AIB-04 and
  the single most likely thing to regress
- MCP: unauthenticated → 401 with a `WWW-Authenticate` challenge; wrong scope → denied; revoked
  token → denied; replayed idempotency key → same receipt and exactly one write; identity passed as
  a tool argument is ignored
- Binary `files` survive the socket round-trip teacher → student

Four scaffolded suites are still unimplemented and named in `.planning/STATE.md`: moderation (7),
export/history/reconnect (8), security/permissions (9), ai-adapter (10). Fill them.

**Gate B:** `npm run test:all` green, and every requirement ID for phases 11–16 has a test that
would fail if that requirement broke.

### Stage C — Functional frontend

Build the UI so the product **works**, not so it looks finished. A later pass handles visual design.

Rules for this stage:
- Use the existing design tokens in `app/styles/tokens.css` and the existing components under
  `components/`. **Invent no new visual language, no new color values, no new component patterns.**
- Follow `docs/05_UI_UX_SPEC.md` and `docs/06_DESIGN_SYSTEM.md` for structure and layout.
  `.planning/VISUAL_DIRECTION.md` and `.planning/UI-ALIGNMENT-DECISIONS.md` record decisions already
  made — follow them, do not relitigate them.
- Skip animation, micro-interaction and polish entirely. Correct states and correct data flow only.
- Do handle the states that are easy to forget: loading, empty, error, disconnected, permission-denied.

Screens to build:
- Teacher: template library, board import, AI draft review (accept / edit / discard), quiz authoring,
  reveal control, leaderboard projection, locked-quiz toggle
- Student: name entry at join, roam-and-answer on revealed board questions, locked full-screen final
  quiz, on-demand leaderboard

**Gate C:** typecheck and build green; no console errors on the main flows.

### Stage D — End-to-end flow

Run it for real: `npm run dev:all`, one teacher tab and two student tabs.

Walk the whole product: teacher signs in → imports a prepared board → starts a session → students
join and enter names → live strokes render → follow-mode works → students post anonymous doubts →
teacher reveals a board question → students roam and answer → leaderboard updates → teacher runs the
locked final quiz → class ends → final board persists → export works → reconnect works. Then: an MCP
client authors a lesson draft into the teacher account and the teacher publishes it.

**Gate D:** every P0 acceptance test in `docs/25_ACCEPTANCE_TESTS.md` passes in a real browser, plus
the phase 11–16 acceptance criteria in `ROADMAP.md`.

### Stage E — Verification, bug fixing, and handoff

- `npm run verify` green from a clean state
- Fix every bug found in Stage D. Root-cause them; do not patch symptoms
- Confirm `ALLOW_DEV_TEACHER` and `ALLOW_PROOF_SOCKET` are off in the production path
- Update `.planning/STATE.md`, the `ROADMAP.md` checkboxes and `REQUIREMENTS.md` to match reality

Then write the handoff document described in §6. **This is a required deliverable, not optional.**

---

## 5. Traps

- **Do not delete or clear `.planning/phases/`.** Most phase directories are untracked in git. Loss
  is unrecoverable.
- **Do not put backticks inside Python or shell strings.** A previous agent had backtick-quoted paths
  inside a Python string, the shell performed command substitution, and it corrupted two planning
  files. Write file content with file-write tools, not shell heredocs.
- **`git status` before every commit**, and stage explicit paths.
- **Do not re-scaffold.** Next.js, Convex and socket-server all exist and work.
- **If the code contradicts a planning doc, stop and record it** in the handoff document rather than
  silently following one or the other.
- Windows: the repo has both PowerShell and Bash available; they take different syntax. For
  multi-line git messages use `git commit -F - <<'EOF'` under Bash.

---

## 6. Required deliverable: `.planning/CODEX-HANDOFF.md`

A second agent picks up from here for hardening and UX. **The accuracy of this document matters more
than the polish of your code.** Write it honestly — an overstated handoff causes worse damage than an
unfinished feature, because the next agent will not re-verify what you claim is done.

Include:

1. **What is complete and verified** — per phase, with the command output you actually saw
2. **What is complete but unverified** — built, compiles, never exercised in a browser
3. **What is incomplete or stubbed** — every TODO, every placeholder, every hardcoded value
4. **Deviations from the specs** — anything you built differently from `docs/33`–`docs/36`, and why
5. **Known bugs you did not fix** — with reproduction steps
6. **Weak spots** — the places you are least confident in, especially anything touching the security
   boundaries in §2.5 and §2.6
7. **Test coverage gaps** — requirement IDs with no real test behind them
8. **Anything you had to guess** — ambiguities in the specs you resolved by assumption

Do not write "complete" next to anything you have not seen pass.

---

## 7. Definition of done

A person can open the site, sign in as a teacher, import a board prepared the night before, run a
live class with two students, reveal a quiz, watch the leaderboard update, run a locked final quiz,
end the class, and export the board — with `npm run verify` green, every requirement for phases 11–16
covered by a test, and `.planning/CODEX-HANDOFF.md` written honestly.

Report what fails as clearly as what passes.
