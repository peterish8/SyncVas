# SyncVas

## What This Is

SyncVas is a classroom companion whiteboard: a teacher writes naturally with stylus/XP-Pen in Excalidraw; students join via short code or QR without accounts; the board syncs live; students pan/zoom locally or Follow Teacher; shy students submit anonymous moderated doubts; ending class persists the board with an export path.

## Core Value

Teacher stroke → students see it live; students can explore independently or follow the teacher; shy students can ask anonymous doubts; class ends with a permanent board.

## Requirements

### Validated

<!-- Milestone 0 is implemented and locally verified; this is not full product value yet. -->

- ✓ Next.js App Router app boots locally — `npm run build` and browser smoke passed
- ✓ Convex health query connected — local development deployment responds
- ✓ Socket-server health/ping path exists — live Socket.IO smoke passed
- ✓ Shared foundation protocol + Vitest coverage present — lint/typecheck/tests passed
- ✓ FOUND-01 — Monorepo `npm run verify` green (lint/typecheck/test/build) + foundation health UI — Validated in Phase 1: Foundation Close-out
- ✓ FOUND-02 — Convex v1 schema with indexed sessions/participants/doubts/votes/exports/moderationEvents — Validated in Phase 1: Foundation Close-out
- ✓ FOUND-03 — Versioned shared Socket.IO board/viewport Zod protocol consumed by app + socket-server — Validated in Phase 1: Foundation Close-out

### Active

<!-- v1.0 = P0 + P1 only. Detailed REQ IDs live in REQUIREMENTS.md. -->

- [ ] Teacher creates/ends live rooms with short code + QR join
- [ ] Excalidraw teacher board syncs live to read-only students
- [ ] Student local pan/zoom + Follow Teacher / free-roam
- [ ] Anonymous doubts with rate limits, teacher queue, answer/dismiss, same-doubt vote
- [ ] Deterministic moderation + AI triage via adapter
- [ ] End-class persistence, image/PDF export, history, reconnect UX
- [ ] Permission tests + 100-viewer load smoke + deploy hardening

### Out of Scope

- Multi-writer / student drawing — MVP is teacher-only editor
- Student cursors / chat — explicit non-goals
- Yjs/CRDTs — single writer; no concurrent edit conflicts
- Raw high-frequency pen events in Convex — cost/perf; Socket.IO only
- Bookmarks, rewind/timeline, confusion pulse — v2 / P2
- AI structured lecture notes as product feature — v2 (end-class must still succeed if AI fails)
- Embedding-based question clustering, teacher analytics — v2
- HWR on live stroke path, A/V conferencing, attendance — deferred
- Paid plans / org tenants — deferred
- LMS replacement / public social features — not the product

## Context

- **Brownfield:** Repo already has Next.js (App Router), Convex health, `socket-server` package, `shared/protocol`, and vitest. Roadmap starts at foundation close-out, not empty-repo scaffold.
- **Docs spine:** `docs/03_MVP_SCOPE.md`, `docs/05_UI_UX_SPEC.md`, `docs/06_DESIGN_SYSTEM.md`, `docs/22_ROADMAP_AND_MILESTONES.md`, `docs/25_ACCEPTANCE_TESTS.md`, and `AGENTS.md` are authoritative for MVP rules.
- **Success metric:** Teacher draws in one browser; two student browsers update live; follow/free-roam works; anonymous doubts + rate limits work; end class persists board with export path — all without P2 features.
- **Gate:** Do not start P1 work (moderation polish / export / history UX) until P0 acceptance holds in 1 teacher + 2 student tabs.

## Constraints

- **Stack**: Next.js App Router + Convex + Socket.IO + Excalidraw, TypeScript strict — locked product architecture
- **Solo MVP**: Boring, reliable architecture over framework cleverness
- **Authz**: Validate every public Convex arg; ownership checks on relevant public mutations; internal work uses internal functions
- **Data path**: Indexed Convex queries only on production paths; no unindexed full-table scans
- **Realtime**: Versioned/validated Socket.IO payloads; never log raw doubt text or secret tokens in production telemetry
- **AI**: Cheap deterministic checks before AI; never hardcode LLM provider in feature code — use adapter
- **Quality**: Permission-boundary tests before polish; initial load target 100 students/room
- **UI**: Warm-neutral, low-noise classroom chrome; softly blended color fields are contained accents only and must never cover or compete with the drawing surface
- **Scope control**: If implementation conflicts with MVP docs, stop and report — do not silently redesign

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Convex = durable SoT + reactive app state | Sessions, doubts, votes, exports, AI jobs | ✓ Locked |
| Socket.IO = ephemeral board + viewport | Pen transport must not go through Convex reactivity | ✓ Locked |
| Excalidraw = drawing engine | MIT, embeddable React | ✓ Locked |
| No Yjs/CRDT in MVP | Teacher-only writer; no concurrent edit conflicts | ✓ Locked |
| No student cursors / no chat in MVP | Scope control | ✓ Locked |
| Teacher-only board editor | Core product rule | ✓ Locked |
| Student pan/zoom local only | Must never move teacher or other students | ✓ Locked |
| Follow mirrors teacher viewport only while enabled; manual pan/zoom exits follow locally | Product rule | ✓ Locked |
| Anonymous student join; doubts anonymous in teacher UI; pseudonymous participant IDs backend | Abuse controls without identity exposure | ✓ Locked |
| Do not persist raw HF pen pointer events to Convex | Cost/perf | ✓ Locked |
| Cheap spam/rate-limit before AI; AI only via adapter | Cost + portability | ✓ Locked |
| Auth abstracted (Convex Auth still evolving) | Avoid lock-in | ✓ Locked |
| v1 = P0+P1 only; P2/deferred = v2 | User-locked planning scope | ✓ Locked |
| Tablet reference informs aesthetic, not information architecture | Preserve canvas-first classroom product; use the documented warm-neutral system rather than dashboard cards | ✓ Locked |
| Third-party API configuration is last | Core Convex/Socket product paths are code-first; a live AI provider is optional and isolated behind the adapter after hardening | ✓ Locked |

## Evolution

After each phase transition:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active (and REQUIREMENTS.md)
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

---
*Last updated: 2026-09-04 — Phase 1 Foundation Close-out complete*
