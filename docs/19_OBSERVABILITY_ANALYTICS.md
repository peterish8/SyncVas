# 19 — Observability and Minimal Analytics

## Operational metrics

Socket service:
- active connections
- active rooms
- room sizes
- board update events/sec
- viewport events/sec
- rejected unauthorized events
- reconnects
- payload validation failures
- process memory/CPU

Convex/product:
- session starts/ends
- join successes/failures
- doubt moderation outcomes
- export success/failure
- AI latency/failure

## Structured logs

Include:
- event name
- session ID (opaque)
- role
- board version
- error code
- latency

Exclude raw secrets, raw doubt text, board JSON.

## Product analytics

Keep MVP small:
- follow activations
- doubts submitted
- same-doubt votes
- class completion

Do not build student surveillance metrics such as “attention score”.

## Alert-worthy failures

- export failure rate spike
- socket server crash loop
- large unauthorized event spike
- AI spend/usage anomaly
- Convex usage limit approaching threshold
