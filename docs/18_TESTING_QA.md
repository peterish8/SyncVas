# 18 — Testing and QA Strategy

## Unit tests

- join code normalization/validation
- room lifecycle state machine
- permission helpers
- doubt rate limiting
- profanity/noise rules
- duplicate vote prevention
- moderation decision mapping
- socket payload validators
- board version comparison

## Integration tests

Convex:
- unauthenticated teacher actions fail
- teacher cannot modify another teacher's session
- ended session rejects new joins/doubts
- student cannot resolve doubt
- vote uniqueness holds under concurrent requests

Socket:
- student `board:update` rejected
- student viewport broadcast rejected
- teacher update reaches room students
- student from room A never receives room B events
- stale board version rejected/ignored

## Browser E2E

Run at minimum three contexts:
- teacher desktop
- student A
- student B/mobile viewport

Scenarios:
1. start room, join by code
2. draw and verify both students
3. student A pans away; B remains unaffected
4. A follows teacher; teacher moves; A follows
5. A manually pans; follow stops
6. submit doubt -> teacher queue
7. rate-limit spam
8. disconnect/reconnect student
9. late join loads current board
10. end class -> artifact visible

## Hardware QA

Actual XP-Pen test is mandatory before calling stylus support complete.

## Load test

Initial target: 1 teacher + 100 students in a single room. Measure:
- socket CPU/memory
- board event rate
- median/p95 delivery delay
- reconnect behavior
- browser frame responsiveness on teacher device
