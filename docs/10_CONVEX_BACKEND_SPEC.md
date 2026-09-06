# 10 — Convex Backend Specification

## Public queries

### `sessions.getTeacherSession(sessionId)`
Teacher-only. Returns session metadata and export status.

### `sessions.getJoinInfoByCode(code)`
Returns only safe public join metadata for a currently live room.

### `doubts.listTeacherQueue(sessionId)`
Teacher-only reactive query. Accepted/uncertain doubts ranked by vote count then age.

### `sessions.listTeacherHistory()`
Teacher-only paginated query.

### `exports.getForSession(sessionId)`
Permission checked.

## Public mutations

### `sessions.create()`
- require authenticated teacher
- generate server-side join code
- create draft/live session
- return session ID/code

### `sessions.start(sessionId)`
Owner only. Transition to live.

### `sessions.end(sessionId)`
Owner only. Transition live -> ending, revoke new join authorization, schedule internal finalization.

### `participants.joinByCode(code, anonymousProof)`
- live session only
- upsert pseudonymous participant
- return safe participant/session identifiers plus mechanism to obtain socket token

### `doubts.submit(...)`
- validate participant belongs to live session
- enforce length/rate rules
- cheap screening
- insert screening record if AI needed
- schedule internal moderation action

### `doubts.vote(doubtId)`
- one vote per participant
- same session
- only accepted/uncertain doubts

### `doubts.resolve(doubtId, action)`
Teacher owner only.

## Internal functions

- `internal.sessions.finalize`
- `internal.board.persistSnapshotMetadata`
- `internal.doubts.runModeration`
- `internal.exports.generateBoardExport`
- `internal.summaries.generate`

Scheduled functions should target internal functions.

## Actions

Use actions only when external APIs or long-running non-transactional work is needed:
- AI moderation
- AI summary
- PDF/image generation if implemented externally
- socket token signing endpoint support if necessary

## Validation/authorization pattern

Every public function:
1. validate args
2. resolve identity/participant
3. verify session status
4. verify role/ownership
5. execute indexed DB work
6. return minimal data

Never trust teacher ID, participant ID, role, vote count, moderation status, or session ownership supplied by the browser.
