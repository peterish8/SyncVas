# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

`AGENTS.md` holds the non-negotiable product and engineering rules for this repo — read it before changing code. The `docs/` directory is the authoritative specification set (`docs/00_START_HERE.md` is the index); `docs/25_ACCEPTANCE_TESTS.md` is the definition of done. If an implementation request conflicts with the specs, report the conflict rather than redesigning silently.

`.planning/` is GSD workflow state (roadmap, phases, decisions). It is excluded from `tsc` and is not application code.

## Navigating the code: graft first

This repo is indexed by [graft](graft/INDEX.md), a prebuilt code graph that answers with exact `file:line`. Use it before `grep`, `Glob`, or reading whole files. It costs fewer tokens and it knows call edges, which text search can't see.

Pick the one tool that fits the question, act on the answer, and move on. Most tasks need a single call. Don't re-run the same tool with the question reworded; if the answer isn't enough, switch to the tool that covers the next need.

| Need | Command | Notes |
| --- | --- | --- |
| "How does X work?" / "Where is Y?" | `graft ask "<task>" --source` | Ranked nodes with the key lines inlined. Add `--full` for the whole span. The default starting point. |
| Every occurrence of a literal | `graft grep "<literal>"` | Exhaustive, grouped by enclosing symbol. `ask` is top-N and will miss instances. |
| A file's API surface | `graft skeleton <file>` | All signatures and spans for about 200 tokens. Use it instead of reading the file. |
| Who calls it / what it calls | `graft callers <sym>` (`--direction out` for callees) | Exact edges from the graph. |
| Blast radius before a change | `graft callers <sym> --depth all` | Run this before any rename, refactor, or multi-file change. |
| Impact of the current diff | `graft blast` | What depends on the lines you touched. |
| Orienting in an unfamiliar area | `graft map` | Clusters, hubs, hotspots. The map is the answer; don't then `skeleton` every subsystem it lists. |

Scope a query to one runtime with `--in <path>/`, e.g. `graft ask "room revoke" --in socket-server/`. The same graph is exposed as MCP tools (`graft_find_code`, `graft_find_all`, `graft_trace_calls`, `graft_file_api`, `graft_repo_map`) when the host has the graft server connected. Otherwise use the CLI.

If you already know the file or symbol, skip `ask`: run `graft grep "<symbol>"`, read that span, and edit. `ask` is for when you don't yet know where the code lives.

Where this matters most in this repo:

- **Things implemented more than once.** The SVRT1 token exists in three places (see Room admission below). The three copies don't call each other, so `callers` only sees one at a time. Run `graft grep "SVRT1"` to find all three, then `graft callers mintRoomToken --depth all` for the socket-server copy's dependents, and change all three together. Editing one file and stopping is the usual mistake.
- **Protocol changes.** A new or changed socket event touches `shared/protocol/socket.ts`, `socket-server/src/protocol.ts`, and the client hooks. Use `graft grep "SOCKET_EVENTS.<name>"` to find every sender and receiver.
- **Convex functions.** Generated `api`/`internal` references don't always show up as direct calls. When `callers` comes back thin for a Convex function, follow up with `graft grep "<fnName>"`.

`graft/` is a local cache: it is gitignored and not committed. Rebuild it with `graft build` after large changes, or when `graft check` reports it stale. Fall back to plain `grep`/`Read` for non-code files graft doesn't index (`docs/`, `.planning/`, CSS), and for files created after the last build.

## Commands

```bash
npm run dev            # Next.js only (:3000)
npm run dev:socket     # Socket.IO server only (:4001)
npm run dev:all        # both concurrently
npx convex dev         # Convex dev process (run alongside the above)

npm run lint           # eslint over app components convex shared tests socket-server
npm run typecheck      # root tsc --noEmit + socket-server tsc --noEmit
npm run test           # root vitest (tests/**/*.test.ts)
npm run test:all       # root vitest + socket-server vitest
npm run verify         # lint + typecheck + test:all + build  ← run before declaring work done
```

Single test file:

```bash
npx vitest run tests/follow-mode.test.ts          # root suite
npx vitest run tests/follow-mode.test.ts -t "name" # single case
npm --prefix socket-server run test -- test/protocol-contract.test.ts
```

`socket-server` is an npm workspace with its own `tsconfig.json`, `vitest.config.ts`, and dependencies. The root `tsconfig.json` explicitly **excludes** `socket-server`, so root `tsc` will not catch errors there — always use `npm run typecheck`, never bare `tsc`.

## Architecture

Three runtimes, deliberately separated:

| Runtime | Role |
| --- | --- |
| Next.js App Router (`app/`, `components/`, `lib/`) | UI; teacher and student board shells |
| Convex (`convex/`) | Durable source of truth: sessions, participants, doubts, snapshots, exports, quizzes |
| Socket.IO server (`socket-server/`) | Ephemeral low-latency transport for live board scenes and teacher viewport |

**The central invariant: high-frequency board/pointer traffic never touches Convex.** The socket server keeps only the latest `{version, scene, files, viewport}` per room in memory (`socket-server/src/board-hot-state.ts`); Convex stores versioned snapshots at session boundaries. A single writer (the teacher) means no CRDT — do not introduce Yjs.

### Wire protocol

`shared/protocol/socket.ts` is the single source of truth for every socket event: `SOCKET_PROTOCOL_VERSION`, the `SOCKET_EVENTS` map, and a Zod schema per payload. Both sides import it — the Next app as `@/shared/protocol/socket`, the socket server as `../../shared/protocol/socket.js` (ESM, so the `.js` extension is required in socket-server imports). Any new event needs a schema here plus a handler in `socket-server/src/protocol.ts`; payloads are size-capped via `boundedJsonValue`.

Board updates carry a monotonic `boardVersion`. Receivers ignore equal-or-older versions (`setHotScene`, and the version ref in `components/board/use-board-sync.ts`).

### Room admission (SVRT1 tokens)

Role is established once at handshake from a signed token and is **never** read from a client event payload. The token is a JWT-shaped HMAC-SHA256 string with `typ: "SVRT1"` and claims `{v, sessionId, role, subjectId, exp}` (5 min TTL). The format is implemented three times against three crypto APIs and they must stay byte-compatible:

- `convex/sessions.ts` — production minting, WebCrypto (this is the real path)
- `socket-server/src/server.ts` — `mintRoomToken` / `verifyRoomToken`, `node:crypto`
- `lib/socket-token.ts` + `app/api/proof-socket-token/route.ts` — dev/proof minting only, gated on `NODE_ENV === "development" && ALLOW_PROOF_SOCKET=1`

All three read `SOCKET_INTERNAL_SECRET` (minimum 32 chars). Ending a session calls `convex/internal/revokeRoom.ts`, which POSTs an HMAC-timestamp-signed body to the socket server's `/internal/revoke-room` to evict live sockets.

### Convex conventions

- One domain file per feature (`sessions.ts`, `doubts.ts`, `exports.ts`, …); privileged/scheduled work lives in `convex/internal/`.
- Files under `convex/internal/` land in the generated API under a slash-containing key, so they are referenced with a cast: `(internal as unknown as {...})["internal/revokeRoom"].run`. Follow the existing pattern in `convex/sessions.ts` rather than inventing a new one.
- Every public function validates args with `v.*` and performs an ownership check via the helpers in `convex/auth.ts` (`requireTeacher`, `requireSessionOwner`). Identity comes from `ctx.auth` — never from a client-supplied `teacherId`.
- `ALLOW_DEV_TEACHER=1` enables a parallel set of `*LocalDev*` helpers/mutations that bootstrap an anonymous teacher for local work. These must never be reachable in production; production paths keep using `requireTeacher`.
- Query with indexes defined in `convex/schema.ts`; no full-table scans in production paths.

### AI

Two adapters, both provider-agnostic and both invoked only from Convex internal actions. Never import a provider SDK from feature or UI code, and never log raw board text, doubt text, or credentials.

- **Moderation** — `lib/ai/moderation-adapter.ts`, called from `convex/internal/moderation.ts` with a hard timeout that degrades to `uncertain`. Cheap deterministic screening (regex noise/profanity, rate limits) happens in `convex/doubts.ts` first.
- **Post-class summary** — `lib/ai/summary-adapter.ts` (schemas + normalization) with selection in `lib/ai/summary.ts` and the Gemini REST implementation in `lib/ai/providers/gemini.ts`. Driven by `convex/internal/summarize.ts`, scheduled from `sessions.finalize` strictly *after* the board is durable, so AI failure never affects End Class. See `docs/39_AI_SUMMARY_SETUP.md`.

`getSummaryAdapter()` is the single selection point; provider modules import from `summary-adapter.ts` and never the reverse, which is why selection lives in its own file. Model output is passed through `normalizeSummaryResult()` (trim/coerce) before Zod validation, so a chatty model loses a field rather than the whole summary.

### Board grammars / blocks

`lib/blocks/` compiles bounded source text (mermaid, code, math, automata, …) into Excalidraw element skeletons plus `BinaryFiles`. `BLOCK_GRAMMARS` in `lib/blocks/types.ts` enumerates the supported set; compile failures use the typed `BlockCompileError` codes.

## Styling

Tailwind v4, configured entirely in CSS. `app/globals.css` is a thin composition root mapping semantic tokens onto Tailwind utilities via `@theme inline`; the actual values and rules live in four layers — `app/styles/tokens.css` (primitives → semantic roles → dark theme), `base.css`, `components.css` (`syncvas-*` product components), `landing.css` (`origin-*` marketing surface). Extend an existing layer; do not add a fifth parallel naming system.

## Error codes

UI maps stable codes to friendly text. Use the existing set: `SESSION_NOT_LIVE`, `FORBIDDEN`, `INVALID_JOIN_CODE`, `RATE_LIMITED`, `STALE_BOARD_VERSION`, `PAYLOAD_TOO_LARGE`, `MODERATION_REJECTED` (see `docs/28_ERROR_CODES.md`).

## Notes

- Many files carry a `@phase` / `@scaffold` header comment describing which milestone owns them and what must not be added. Keep those headers accurate when extending a file.
- `AGENTS.md` contains a `BEGIN:nextjs-agent-rules` block regenerated by `next dev`; commit it with your work rather than reverting it.
