# 08 — System Architecture

## Logical diagram

```text
Teacher Browser
  ├─ Next.js UI
  ├─ Excalidraw editor
  ├─ Convex client ───────────────┐
  └─ Socket.IO client ────────┐   │
                              │   │
Student Browsers              │   │
  ├─ Excalidraw viewer        │   │
  ├─ Convex client ───────────┼───┼──> Convex Cloud
  └─ Socket.IO client ────────┼───┘    DB / Functions / Storage
                              │
                              └──────> Socket.IO Service
                                      room broadcast
                                      board hot state
                                      viewport presence
```

## Data ownership

### Convex authoritative
- session exists/is live/is ended
- who owns teacher session
- participant pseudonymous records
- doubts/votes
- moderation decisions
- board snapshot references
- final export/summary state

### Socket authoritative only while connected
- active socket presence
- latest transient viewport
- in-memory latest live scene cache

Socket state is reconstructable from Convex snapshot + teacher client.

## Why no CRDT in MVP

There is one board writer. Conflict-free replicated editing adds complexity without user value. If TAs/multiple editors become a requirement, revisit this decision.

## Recommended repository shape

```text
app/
  (teacher)/
  join/
  session/
components/
features/
  board/
  doubts/
  sessions/
  follow/
convex/
  schema.ts
  sessions.ts
  doubts.ts
  participants.ts
  boardSnapshots.ts
  exports.ts
  ai/
socket-server/
  src/
    index.ts
    auth.ts
    rooms.ts
    protocol.ts
    validators.ts
shared/
  protocol/
  types/
```

Prefer a single repository for solo development.
