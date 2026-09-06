# 11 — Realtime Socket Protocol

## Goal

Transport teacher board changes and viewport state with minimal latency while preserving a simple single-writer security model.

## Namespace/room

One logical room per live session: `session:{sessionId}`.

Client handshake auth carries a short-lived server-signed token with:
- `sessionId`
- `role: teacher | student`
- `subjectId`
- `exp`

## Event envelope

```ts
{
  v: 1,
  sessionId: string,
  ts: number,
  ...payload
}
```

Validate all incoming payloads.

## Client -> server

### `room:join`
Normally implicit after authenticated socket connection; server joins validated room.

### `board:update` — teacher only
Payload:
- `boardVersion`
- scene update representation selected during implementation
- optional files metadata references

Server rejects if role != teacher.

### `board:request-current`
Student/teacher reconnect asks for current scene/version.

### `teacher:viewport` — teacher only
Payload:
- `x`
- `y`
- `zoom`
- optional current page identifier if needed

Throttle client-side (e.g. ~10–15 updates/sec). Treat as lossy/ephemeral; latest state matters more than every intermediate frame.

## Server -> client

### `board:current`
Full canonical current scene + `boardVersion`.

### `board:update`
Incremental/new scene state + `boardVersion`.

### `teacher:viewport`
Latest teacher viewport.

### `room:presence`
Coarse connected count only. Do not send student identities/cursors.

### `protocol:error`
Machine code + safe message.

## Board version rules

- Teacher increments boardVersion only for board content state changes.
- Server discards stale/non-monotonic versions from teacher connection unless recovering through an explicit resync path.
- Student applies only versions newer than current.
- On version gap or reconnect, request `board:current`.

## Backpressure

Do not queue unlimited viewport events. Drop/coalesce them. Board updates must be more reliable than viewport animation.

## Reconnect

After reconnect:
1. re-authenticate token or obtain a new one
2. join room
3. request current board
4. reconcile version
5. resume viewport stream

## Scale path

MVP can run one Socket.IO service instance. Multi-instance scale later requires a shared adapter/broker and sticky/session-compatible deployment strategy. Do not add this before load tests demand it.
