# Roadmap: SyncVas

## Overview

Deliver SyncVas v1.0 (P0 + P1) on the existing brownfield scaffold: close out foundation, prove teacher→student live board sync, wire real room lifecycle, add Follow Teacher, ship the anonymous doubts loop, layer deterministic + adapter AI moderation, persist/export/history with reconnect UX, then harden with permission tests, 100-viewer load, and deploy. P2 and explicitly deferred work stay parked under Deferred: v2.0 — not executable phases now.

**Granularity:** standard (8 phases)
**Scope gate:** Phases 1–5 deliver P0. Do not start Phase 6+ until P0 acceptance holds in 1 teacher tab + 2 student tabs.

## Phases

- [ ] **Phase 1: Foundation Close-out** - Schema, shared protocol, and verify scripts ready on brownfield scaffold
- [ ] **Phase 2: Board Proof** - Teacher draws in Excalidraw; two students update live read-only
- [ ] **Phase 3: Room Lifecycle** - Auth, create/end session, short code/QR, anonymous join, student count
- [ ] **Phase 4: Follow Teacher** - Viewport stream with local follow/free-roam and return
- [ ] **Phase 5: Doubts Loop** - Anonymous submit, rate limits, teacher queue, answer/dismiss, same-doubt vote
- [ ] **Phase 6: Moderation** - Deterministic filters + AI adapter triage with uncertain fallback
- [ ] **Phase 7: Persist, Export & Reconnect UX** - Final board save, image/PDF export, history, reconnect/toasts
- [ ] **Phase 8: Hardening** - Permission tests, 100-viewer load, deploy, XP-Pen production verify

## Phase Details

### Phase 1: Foundation Close-out
**Goal**: Brownfield scaffold is production-shaped — schema, shared protocol, and verify scripts support all later phases
**Depends on**: Nothing (first phase; scaffold already exists)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. Developer can run local health checks and see Next.js, Convex, and socket-server respond
  2. Lint, typecheck, and unit test scripts pass on the monorepo
  3. Shared protocol package exports versioned board/viewport event types consumed by app and socket-server
  4. Convex schema includes indexed tables for sessions, participants, doubts, votes, exports, and AI jobs
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Close Convex schema skeleton + indexes for v1 entities
- [ ] 01-02-PLAN.md — Harden shared Socket.IO protocol types/validators + package wiring
- [ ] 01-03-PLAN.md — Verify scripts and local health smoke path (app / Convex / socket-server)

### Phase 2: Board Proof
**Goal**: Teacher stroke appears live on two student browsers with read-only enforcement and local pan/zoom
**Depends on**: Phase 1
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06
**Success Criteria** (what must be TRUE):
  1. Teacher can draw with stylus/XP-Pen on Excalidraw and see strokes locally immediately
  2. Two student browsers show the teacher's board updates in near real time via Socket.IO
  3. A late joiner receives the current scene without replaying full stroke history
  4. Students cannot mutate board content even if they emit socket events manually
  5. Student pan/zoom does not move the teacher camera or another student's viewport
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: Embed Excalidraw teacher canvas + stylus path
- [ ] 02-02: Socket.IO room broadcast + student scene apply
- [ ] 02-03: Late-join bootstrap + student read-only / local viewport enforcement

### Phase 3: Room Lifecycle
**Goal**: Teachers create and end real sessions; students join the correct live room via code or QR without accounts
**Depends on**: Phase 2
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05
**Success Criteria** (what must be TRUE):
  1. Authenticated teacher can create a live session and receive a unique short code
  2. QR and short code both join the same live room for accountless students
  3. Ending a class rejects further joins while preserving session identity for later persistence work
  4. Teacher UI shows live student/participant count for the active room
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: Teacher auth abstraction + create/end session mutations
- [ ] 03-02: Short code + QR join flow for anonymous students
- [ ] 03-03: Live/ended room gating + student count

### Phase 4: Follow Teacher
**Goal**: Students can mirror the teacher viewport or free-roam independently, with safe local follow exit
**Depends on**: Phase 3
**Requirements**: FOLLOW-01, FOLLOW-02, FOLLOW-03, FOLLOW-04
**Success Criteria** (what must be TRUE):
  1. Student enabling Follow Teacher mirrors the teacher's viewport while follow stays on
  2. Manual pan/zoom exits follow locally without affecting teacher or other students
  3. Student can return to Follow Teacher after free-roam
  4. Dropped/lost viewport packets do not corrupt board content
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: Teacher viewport stream over Socket.IO
- [ ] 04-02: Student follow state, exit-on-pan, and return control
- [ ] 04-03: Viewport loss resilience checks vs board integrity

### Phase 5: Doubts Loop
**Goal**: Anonymous doubt submission loop works end-to-end without AI — rate limits, queue, resolve, vote
**Depends on**: Phase 4
**Requirements**: DOUBT-01, DOUBT-02, DOUBT-03, DOUBT-04, DOUBT-05
**Success Criteria** (what must be TRUE):
  1. Student can submit a doubt that shows no student name in the teacher UI
  2. Spammy repeats from the same participant hit rate limits without calling AI
  3. Teacher sees a reactive queue and can mark doubts answered or dismissed
  4. A participant can vote a doubt only once (same-doubt vote)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: Participant records + anonymous doubt composer/submit
- [ ] 05-02: Deterministic rate limiting + teacher reactive queue
- [ ] 05-03: Answer/dismiss actions + same-doubt voting rules

### Phase 6: Moderation
**Goal**: Noise is filtered cheaply first; AI triage via adapter improves relevance without silent drops
**Depends on**: Phase 5 (and P0 gate: Phases 1–5 acceptance in 1 teacher + 2 student tabs)
**Requirements**: MOD-01, MOD-02, MOD-03, MOD-04
**Success Criteria** (what must be TRUE):
  1. Profanity/noise rules block obvious junk before any AI call
  2. Relevance triage runs only through the provider-agnostic AI adapter
  3. Uncertain or failed AI classification does not silently lose a plausible doubt
  4. Teacher can see duplicate suggestions for similar doubts
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: Deterministic profanity/noise filter pipeline
- [ ] 06-02: AI adapter + relevance triage with uncertain fallback
- [ ] 06-03: Duplicate suggestion wiring into teacher queue UX

### Phase 7: Persist, Export & Reconnect UX
**Goal**: Ending class leaves a durable board with export/history paths and graceful reconnect/error UX
**Depends on**: Phase 6
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Ending class persists the final board scene so it survives refresh
  2. Teacher can export the final board as image and/or PDF and see export job state
  3. Past classes appear on a teacher history page
  4. Refresh/reconnect restores the latest board; join/queue/history failures show clear empty/error states
  5. Optional AI summary failure does not lose the persisted board
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 07-01: End-class finalize + durable final scene persistence
- [ ] 07-02: Image/PDF export jobs with visible state + history page
- [ ] 07-03: Reconnect/resync UX + error toasts/empty states

### Phase 8: Hardening
**Goal**: Permission boundaries, load target, and production deploy are proven for v1 demo reliability
**Depends on**: Phase 7
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, LOAD-01
**Success Criteria** (what must be TRUE):
  1. Student clients cannot impersonate teacher via spoofed role fields; cross-room leakage tests pass
  2. Convex public mutations enforce ownership/authorization; secrets are absent from the browser bundle
  3. Automated permission-boundary tests cover teacher vs student capabilities
  4. One teacher + 100 viewers smoke/load test is completed with documented results
  5. Production deploy path works and XP-Pen writing is verified in the production desktop browser target
**Plans**: TBD

Plans:
- [ ] 08-01: Authorization + socket permission/cross-room tests
- [ ] 08-02: 100-viewer load smoke + results notes
- [ ] 08-03: Production deploy + XP-Pen production verification

## Deferred: v2.0

Not executable now. Do not create phases or plans for these until v1.0 ships.

- Bookmarks, periodic snapshots-as-product, rewind/timeline
- Confusion pulse
- AI structured lecture notes / summary product pipeline
- Embedding-based question clustering
- Teacher analytics
- Multi-writer canvas, student annotations
- HWR on live stroke path
- Audio/video, attendance
- Paid plans, org/college tenants

See REQUIREMENTS.md `## v2 Requirements` for IDs.

## Progress

**Execution Order:**
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Close-out | 0/3 | Not started | - |
| 2. Board Proof | 0/3 | Not started | - |
| 3. Room Lifecycle | 0/3 | Not started | - |
| 4. Follow Teacher | 0/3 | Not started | - |
| 5. Doubts Loop | 0/3 | Not started | - |
| 6. Moderation | 0/3 | Not started | - |
| 7. Persist, Export & Reconnect UX | 0/3 | Not started | - |
| 8. Hardening | 0/3 | Not started | - |
