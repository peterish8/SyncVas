# 28 — API/Event Error Codes

Use machine-readable stable codes across Convex and Socket.IO.

## Session
- `SESSION_NOT_FOUND`
- `SESSION_NOT_LIVE`
- `SESSION_ENDED`
- `INVALID_JOIN_CODE`
- `JOIN_CODE_EXPIRED`

## Auth/permission
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_SESSION_OWNER`
- `INVALID_SOCKET_TOKEN`
- `TOKEN_EXPIRED`

## Board
- `STUDENT_BOARD_EDIT_FORBIDDEN`
- `STALE_BOARD_VERSION`
- `BOARD_RESYNC_REQUIRED`
- `PAYLOAD_TOO_LARGE`
- `INVALID_BOARD_PAYLOAD`

## Doubt
- `DOUBT_TOO_LONG`
- `DOUBT_TOO_SHORT`
- `RATE_LIMITED`
- `DUPLICATE_DOUBT`
- `MODERATION_REJECTED`
- `ALREADY_VOTED`

## Export/AI
- `EXPORT_FAILED`
- `SUMMARY_FAILED`
- `AI_TIMEOUT`
- `AI_BUDGET_EXCEEDED`

## UI rule

Never expose stack traces/internal errors to students. Map machine codes to short actionable copy.
