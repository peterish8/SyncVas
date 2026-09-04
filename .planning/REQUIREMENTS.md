# Requirements: SyncVas

**Defined:** 2026-09-04
**Core Value:** Teacher stroke → students see it live; students explore or follow; anonymous doubts; class ends with a permanent board.

## v1 Requirements

Requirements for v1.0 (P0 + P1 only). Each maps to exactly one roadmap phase.

### Cross-cutting visual system

Every UI phase must follow `docs/05_UI_UX_SPEC.md` and `docs/06_DESIGN_SYSTEM.md`: the classroom remains canvas-first and high contrast; warm-neutral surfaces and contained color fields may support product state but never replace it or sit over the drawable board.

### Foundation

- [x] **FOUND-01**: Local monorepo health works — Next.js app, Convex health query, and socket-server ping respond; lint/typecheck/test scripts are green
- [x] **FOUND-02**: Convex schema covers sessions, participants, doubts, votes, exports, and AI jobs with indexed query paths
- [x] **FOUND-03**: Shared Socket.IO protocol package defines versioned, validated payloads for board and viewport events usable by app and socket-server

### Room Lifecycle

- [ ] **ROOM-01**: Authenticated teacher can create a live classroom session
- [ ] **ROOM-02**: Session exposes a unique short join code and QR that both open the same room
- [ ] **ROOM-03**: Students can join a live session without accounts
- [ ] **ROOM-04**: Teacher can end a session; ended sessions reject new joins
- [ ] **ROOM-05**: Teacher sees live student/participant count for the active room

### Board Sync

- [ ] **BOARD-01**: Teacher can draw on an Excalidraw canvas with stylus/XP-Pen in a supported desktop browser
- [ ] **BOARD-02**: Teacher strokes appear locally immediately without waiting for network roundtrip
- [ ] **BOARD-03**: Connected students receive live board updates from the teacher via Socket.IO
- [ ] **BOARD-04**: Late-joining students receive current scene bootstrap without historical event replay
- [ ] **BOARD-05**: Students cannot mutate board content (UI and socket enforcement)
- [ ] **BOARD-06**: Student pan/zoom is local-only and never moves the teacher camera or other students

### Follow Teacher

- [ ] **FOLLOW-01**: Student can enable Follow Teacher and mirror the teacher's viewport while follow is on
- [ ] **FOLLOW-02**: Student manual pan/zoom exits follow mode locally without affecting others
- [ ] **FOLLOW-03**: Student can return to Follow Teacher after free-roam
- [ ] **FOLLOW-04**: Viewport packet loss does not corrupt board content

### Doubts

- [ ] **DOUBT-01**: Student can submit a doubt that appears anonymous in the teacher UI
- [ ] **DOUBT-02**: Backend assigns a pseudonymous participant/session ID used for abuse controls
- [ ] **DOUBT-03**: Repeated spam submissions hit rate limits without requiring an AI call
- [ ] **DOUBT-04**: Teacher sees a reactive doubt queue and can answer or dismiss items
- [ ] **DOUBT-05**: A participant can cast at most one same-doubt vote per doubt

### Moderation

- [ ] **MOD-01**: Deterministic profanity/noise rules filter submissions before any AI call
- [ ] **MOD-02**: AI relevance triage runs through a provider-agnostic adapter (no hardcoded LLM provider in feature code)
- [ ] **MOD-03**: Uncertain or failed AI classification falls back without silently dropping a plausible doubt
- [ ] **MOD-04**: System can suggest duplicates for similar doubts

### Persistence & Export

- [ ] **EXPORT-01**: Ending class persists the final board scene as durable state
- [ ] **EXPORT-02**: Teacher can export the final board as image and/or PDF with visible export job state
- [ ] **EXPORT-03**: Teacher can open a class history page listing past classes
- [ ] **EXPORT-04**: Failure of optional AI summary does not lose the persisted board

### Reconnect & UX

- [ ] **UX-01**: Refresh/reconnect restores the latest board for teacher and students
- [ ] **UX-02**: Key flows show error toasts and empty states (join failures, empty queue, empty history)

### Security & Hardening

- [ ] **SEC-01**: Student socket clients cannot impersonate teacher by spoofing client role fields
- [ ] **SEC-02**: Convex public mutations enforce session ownership/authorization where relevant
- [ ] **SEC-03**: Cross-room socket leakage is prevented; secrets are absent from the browser bundle
- [ ] **SEC-04**: Automated permission-boundary tests cover teacher vs student capabilities
- [ ] **LOAD-01**: One teacher + 100 viewer smoke/load test completed with documented results

## v2 Requirements

Deferred to future release. Tracked but not in current executable roadmap.

### Product (former P2)

- **BOOK-01**: Board bookmarks during/after class
- **SNAP-01**: Periodic board snapshots as a product feature beyond finalize
- **REWIND-01**: Rewind / timeline playback of the board
- **PULSE-01**: Confusion pulse (“I’m confused”) signal
- **NOTES-01**: AI-generated structured lecture notes / summary pipeline as a product feature
- **CLUSTER-01**: Question clustering using embeddings
- **ANALYTICS-01**: Teacher analytics dashboards

### Explicitly deferred platform

- **MULTI-01**: Multi-writer canvas / simultaneous student drawing
- **ANNOT-01**: Student annotations on the shared board
- **HWR-01**: Handwriting recognition on the live stroke path
- **AV-01**: Audio transcription and video conferencing
- **ATTEND-01**: Attendance verification
- **BILL-01**: Paid plans
- **TENANT-01**: Organization/college tenant administration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Student cursors | Explicit MVP non-goal; noise and scope |
| In-class chat | Explicit MVP non-goal; doubts cover shy Q&A |
| Yjs / CRDTs | Teacher-only writer; unnecessary complexity |
| Raw HF pen events in Convex | Cost/perf; Socket.IO ephemeral path only |
| LMS replacement | Not the product |
| Public social feed | Not the product |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete — verify green 2026-09-04 |
| FOUND-02 | Phase 1 | Complete — v1 schema + indexes 2026-09-04 |
| FOUND-03 | Phase 1 | Complete — shared board/viewport protocol 2026-09-04 |
| BOARD-01 | Phase 2 | Pending |
| BOARD-02 | Phase 2 | Pending |
| BOARD-03 | Phase 2 | Pending |
| BOARD-04 | Phase 2 | Pending |
| BOARD-05 | Phase 2 | Pending |
| BOARD-06 | Phase 2 | Pending |
| ROOM-01 | Phase 3 | Pending |
| ROOM-02 | Phase 3 | Pending |
| ROOM-03 | Phase 3 | Pending |
| ROOM-04 | Phase 3 | Pending |
| ROOM-05 | Phase 3 | Pending |
| FOLLOW-01 | Phase 4 | Pending |
| FOLLOW-02 | Phase 4 | Pending |
| FOLLOW-03 | Phase 4 | Pending |
| FOLLOW-04 | Phase 4 | Pending |
| DOUBT-01 | Phase 5 | Pending |
| DOUBT-02 | Phase 5 | Pending |
| DOUBT-03 | Phase 5 | Pending |
| DOUBT-04 | Phase 5 | Pending |
| DOUBT-05 | Phase 5 | Pending |
| EXPORT-01 | Phase 6 | Pending |
| MOD-01 | Phase 7 | Pending |
| MOD-02 | Phase 10 | Pending |
| MOD-03 | Phase 7 | Pending |
| MOD-04 | Phase 7 | Pending |
| EXPORT-02 | Phase 8 | Pending |
| EXPORT-03 | Phase 8 | Pending |
| EXPORT-04 | Phase 8 | Pending |
| UX-01 | Phase 8 | Pending |
| UX-02 | Phase 8 | Pending |
| SEC-01 | Phase 9 | Pending |
| SEC-02 | Phase 9 | Pending |
| SEC-03 | Phase 9 | Pending |
| SEC-04 | Phase 9 | Pending |
| LOAD-01 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓
- v2 deferred (not mapped to executable phases): 14

---
*Requirements defined: 2026-09-04*
*Last updated: 2026-09-04 after planning reconciliation*
