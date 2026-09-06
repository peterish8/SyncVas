# 29 — Repository Folder Structure (implementation map)

> Generated to match SyncVas v1.0 phases 1–10. Stub files in the repo carry `@scaffold` / `@phase` header comments describing what to implement. **Do not invent greenfield paths that conflict with these.**

```text
/
├─ app/
│  ├─ page.tsx                          # Phase 1 foundation health hub (done)
│  ├─ layout.tsx / globals.css          # Phase 1 shell (done)
│  ├─ teacher/
│  │  ├─ page.tsx                       # Phase 2–6 teacher classroom
│  │  └─ history/page.tsx               # Phase 8 history
│  ├─ student/[sessionId]/page.tsx      # Phase 2–5 student room
│  └─ join/
│     ├─ page.tsx                       # Phase 3 code join
│     └─ [code]/page.tsx                # Phase 3 QR deep link
├─ components/
│  ├─ foundation/                       # Phase 1 health (done)
│  ├─ providers/                        # Phase 1 Convex provider (done)
│  ├─ board/                            # Phase 2 + 4 canvas/sync/viewport
│  ├─ room/                             # Phase 3 create/join/QR/count/end
│  ├─ student/follow-controls.tsx       # Phase 4
│  ├─ doubts/                           # Phase 5 + 7
│  ├─ teacher/end-class-panel.tsx       # Phase 6
│  ├─ export/                           # Phase 8
│  ├─ connection/                       # Phase 8
│  └─ ui/                               # design-system primitives
├─ convex/
│  ├─ schema.ts / health.ts             # Phase 1 (done)
│  ├─ auth.ts                           # Phase 3 helpers
│  ├─ sessions.ts / participants.ts     # Phase 3 (+6/8 sessions)
│  ├─ doubts.ts                         # Phase 5 + 7
│  ├─ board.ts / boardSnapshots.ts      # Phase 6
│  ├─ exports.ts                        # Phase 8
│  ├─ moderation.ts                     # Phase 7
│  ├─ http.ts                           # Phase 10 optional
│  └─ internal/
│     ├─ finalizeBoard.ts               # Phase 6
│     ├─ exportJobs.ts                  # Phase 8
│     └─ moderation.ts                  # Phase 7/10
├─ lib/ai/
│  ├─ moderation-adapter.ts             # Phase 7 contract + disabled
│  └─ providers/index.ts                # Phase 10 live provider
├─ shared/
│  ├─ protocol/socket.ts                # Phase 1+ (extend in 2/4)
│  ├─ constants/limits.ts               # Phase 5/7
│  └─ types/session.ts                  # Phase 3
├─ socket-server/src/
│  ├─ index.ts / server.ts              # Phase 1 ping; extend 2–4
│  ├─ auth.ts / rooms.ts                # Phase 3
│  ├─ protocol.ts / board-hot-state.ts  # Phase 2/4
│  └─ validators.ts                     # shared Zod bridge
├─ tests/                               # describe.skip scaffolds per phase
│  └─ security/ + load/                 # Phase 9
├─ .github/workflows/ci.yml             # Phase 9
└─ docs/ + AGENTS.md                    # product law
```

## Phase ownership cheat-sheet

| Phase | Primary paths |
|------:|---------------|
| 1 | `convex/schema`, `shared/protocol`, foundation health, `npm run verify` |
| 2 | `components/board/*`, teacher/student pages, socket board handlers, `tests/board-sync` |
| 3 | `convex/auth|sessions|participants`, `components/room/*`, join routes, socket tokens |
| 4 | viewport protocol + `follow-controls` + `use-teacher-viewport` |
| 5 | `convex/doubts`, doubt UI, permission tests |
| 6 | `convex/board`, `internal/finalizeBoard`, end-class panel |
| 7 | deterministic moderation + `lib/ai/moderation-adapter` |
| 8 | exports, history page, connection/reconnect UX |
| 9 | `tests/security`, `tests/load`, CI, deploy/XP-Pen evidence |
| 10 | `lib/ai/providers`, `convex/internal/moderation`, env-only secrets |

Restore premature WIP from `.planning/wip/premature-phase-2-3/` only when executing Phases 2–3, then replace scaffolds with real implementations.
