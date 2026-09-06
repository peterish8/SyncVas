# 24 — Coding Standards

## TypeScript

- strict mode
- avoid `any`
- discriminated unions for statuses/events
- shared event types live in one module
- runtime validation at network boundaries

## React

- keep Excalidraw wrapper isolated
- local ephemeral UI state stays local
- Convex queries for durable/reactive state
- avoid global state library until real need exists

## Convex

- one domain file per major feature
- public functions small and permission checked
- internal implementation functions for scheduled/privileged workflows
- use indexes rather than JS filtering of large query results
- no secret environment variables in client code

## Socket server

- auth middleware first
- room membership derived from claims
- handler per event family
- payload cap and validation
- no business persistence hidden only in socket memory

## Errors

Use stable codes:
- `SESSION_NOT_LIVE`
- `FORBIDDEN`
- `INVALID_JOIN_CODE`
- `RATE_LIMITED`
- `STALE_BOARD_VERSION`
- `PAYLOAD_TOO_LARGE`
- `MODERATION_REJECTED`

UI maps codes to friendly text.

## Comments

Comment why an invariant exists, not what a line of code obviously does.
