# Ingest Synthesis — SyncVas

**Mode:** new  
**Scope rule (user-locked):** Plan **v1 completely** (P0 + P1 MVP). Park everything else as **v2 deferred** — do not create executable v1 phases for P2/deferred product work.  
**Date:** 2026-09-04

## Product

Classroom companion whiteboard: teacher writes with XP-Pen/stylus in Excalidraw; students join via short code/QR without accounts; live board sync; local pan/zoom; Follow Teacher; anonymous moderated doubts; end class → persisted board + export.

## Core value

Teacher stroke → students see it live; students can explore independently or follow teacher; shy students can ask anonymous doubts; class ends with a permanent board.

## Locked architecture decisions (ADR)

| Decision | Rationale | Status |
|----------|-----------|--------|
| Convex = durable truth + reactive app state | Sessions, doubts, votes, exports, AI jobs | Locked |
| Socket.IO = ephemeral high-frequency board + viewport | Pen transport must not go through Convex reactivity | Locked |
| Excalidraw = drawing engine | MIT, embeddable React | Locked |
| No Yjs/CRDT in MVP | Teacher-only writer; no concurrent edit conflicts | Locked |
| No student cursors / no chat in MVP | Scope control | Locked |
| Teacher-only board editor | Product rule | Locked |
| Student pan/zoom local only | Must never move teacher or other students | Locked |
| Follow mode mirrors teacher viewport only while enabled; manual pan/zoom exits follow locally | Product rule | Locked |
| Students join without accounts; doubts anonymous to teacher UI; backend keeps pseudonymous participant ID | Abuse controls without identity exposure | Locked |
| Do not persist raw high-frequency pen pointer events to Convex | Cost/perf | Locked |
| Cheap spam/rate-limit before AI; never hardcode LLM provider — use AI adapter | Cost + portability | Locked |
| Auth abstracted (Convex Auth still evolving) | Avoid lock-in | Locked |
| Warm-neutral, canvas-first UI system | Tablet reference guides atmosphere only; solid surfaces and contained color fields never compete with handwriting | Locked |
| Tactile UI System for control physics | Raised press / inset inputs / fast timing on Syncvas tokens; palette stays Syncvas, not foreign brand colors | Locked |

## v1 requirements (P0 + P1)

### P0 — must work before demo
- Teacher sign-in; create/end live session
- QR + short code join
- Excalidraw teacher canvas + stylus/XP-Pen
- Socket.IO room join; live board sync teacher → students
- Current scene bootstrap for late joiners
- Student read-only enforcement; independent pan/zoom
- Follow teacher / leave follow / return
- Student count
- Basic anonymous doubt submission + rate limiting
- Teacher doubt queue
- Final board save

### P1 — demo quality
- Profanity/noise rules
- Same-doubt voting
- AI relevance triage (adapter) + uncertain fallback
- Export final board as image/PDF
- Class history page
- Graceful reconnect UX
- Error toasts and empty states

## v2 deferred (NOT in v1 phases)

From MVP P2 + explicitly deferred + Milestone 8:
- Bookmarks, periodic board snapshots as product feature beyond finalize, rewind/timeline
- Confusion pulse (“I’m confused”)
- AI generated structured notes / lecture summary pipeline as product feature
- Question clustering using embeddings
- Teacher analytics
- Multi-writer canvas, student annotations
- Handwriting recognition on live stroke path
- Audio transcription, video
- Attendance verification
- Paid plans, org/college tenant administration

## Suggested phase spine (from docs/22 + backlog epics)

Map to GSD phases for **v1.0 only**. Scaffold (Next.js, Convex health, socket-server health) already partially exists in repo.

1. Foundation close-out (schema skeleton, shared protocol, verify scripts) — brownfield start
2. Board proof (Excalidraw teacher + student apply + broadcast)
3. Room lifecycle (auth, create/end, code/QR, anonymous join)
4. Follow teacher (viewport stream + local follow state)
5. Doubts loop without AI (submit, rate limit, queue, answer/dismiss, same-doubt vote)
6. P0 final-board persistence (end-class finalize and restore evidence before the P1 gate)
7. Moderation (deterministic filters + AI adapter triage)
8. Export/history/reconnect UX (image/PDF export, history page, reconnect/error-state polish)
9. Hardening (permission tests, 100-viewer load, deploy, XP-Pen prod verify)

## Non-goals for v1

Multi-teacher editing, student drawing, audio/video conferencing, LMS replacement, public social chat, complex classroom analytics.

## Constraints

- TypeScript strict
- Validate every public Convex arg; authz/ownership on public mutations
- Indexed queries only on production paths
- Versioned/validated Socket.IO payloads
- Never log raw doubt text or secret tokens in production telemetry
- Permission-boundary tests before polish
- Initial load target: 100 students / room
- Canvas-first, warm-neutral UI system from docs/05 and docs/06; contained color fields are never a substitute for accessible state/copy
- Tactile control physics (`.planning/VISUAL_DIRECTION.md`): raised buttons, inset inputs, no hover scale / glass / continuous pulse

## Existing codebase note

Milestone 0 is verified: Next.js App Router app, local Convex health query, socket-server ping, shared protocol foundation, lint/typecheck/tests/build, and browser smoke all passed. Do not treat the repository as greenfield, and do not treat Foundation Close-out as complete until the schema and expanded protocol requirements pass.
