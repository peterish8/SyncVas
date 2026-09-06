# 22 — Solo Developer Roadmap and Milestones

## Milestone 0 — scaffold

- Next.js TS app
- Tailwind/shadcn
- Convex connected
- separate socket-server package/folder
- lint/test/typecheck

Exit: hello page + Convex query + socket ping all work locally.

## Milestone 1 — board proof

- Excalidraw teacher embed
- XP-Pen test
- static student view
- teacher scene broadcast
- student scene apply

Exit: teacher draws; two viewers update.

## Milestone 2 — room lifecycle

- teacher auth
- create session
- short code
- QR
- anonymous join
- live/ended state

Exit: only live code joins correct room.

## Milestone 3 — follow

- teacher viewport stream
- student follow state
- manual-pan breaks follow
- return button

Exit: two students can independently follow/free-roam.

## Milestone 4 — doubts

- participant record
- composer
- rate limit
- teacher reactive queue
- answered/dismissed
- same-doubt vote

Exit: anonymous question loop reliable without AI.

## Milestone 5 — moderation

- deterministic filters
- provider-agnostic AI interface
- relevance triage
- uncertain fallback

Exit: irrelevant noise blocked without false certainty.

## Milestone 6 — persistence/export

- periodic/final snapshots
- end-class finalize
- board export
- history page

Exit: class survives refresh/end and is downloadable.

## Milestone 7 — hardening

- reconnect/resync
- authorization tests
- load test 100 students
- production deploy
- XP-Pen production verification

## Milestone 8 — optional AI notes

Only after core system is stable.
