# AGENTS.md — Mandatory instructions for coding agents

You are implementing a classroom whiteboard product for a solo developer. Optimize for a small, reliable MVP rather than framework cleverness.

## Read first

Read these in order before changing code:

1. `docs/00_START_HERE.md`
2. `docs/02_PRD.md`
3. `docs/03_MVP_SCOPE.md`
4. `docs/07_TRD.md`
5. `docs/08_SYSTEM_ARCHITECTURE.md`
6. `docs/09_CONVEX_DATA_MODEL.md`
7. `docs/11_REALTIME_SOCKET_PROTOCOL.md`
8. `docs/12_EXCALIDRAW_INTEGRATION.md`
9. `docs/25_ACCEPTANCE_TESTS.md`

## Non-negotiable product rules

- Teacher is the only board editor in MVP.
- Students cannot mutate board content.
- Student pan/zoom is local and must never move the teacher camera or other students.
- Follow mode mirrors teacher viewport only while enabled.
- Any student manual pan/zoom exits follow mode locally.
- Students may join without accounts.
- Doubts shown to teachers are anonymous by default.
- Backend still assigns a pseudonymous participant/session ID for abuse controls.
- Do not persist raw high-frequency pen pointer events to Convex.
- Do not add Yjs/CRDTs in MVP.
- Do not add student cursors.
- Do not add chat.
- Do not require an AI call for basic spam/rate-limit checks.
- Never hardcode an LLM provider into feature code; use the AI adapter.

## Engineering rules

- TypeScript strict mode.
- Validate every public Convex function argument.
- Every public Convex function must perform authorization/ownership checks when relevant.
- Scheduled/internal work should call internal Convex functions, not public API functions.
- Avoid unindexed full-table scans in production paths.
- Await all promises.
- Keep Socket.IO event payloads versioned and validated.
- Log event names and room IDs, but never log raw doubt text or secret tokens in production telemetry.
- Write tests for permission boundaries before adding polish.

## Scope control

If a requested implementation conflicts with the MVP docs, stop and report the conflict instead of silently redesigning the system.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
