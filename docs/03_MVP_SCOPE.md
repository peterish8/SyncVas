# 03 — MVP Scope and Feature Gates

## P0 — must work before any demo

- teacher sign-in
- create/end live session
- QR + short code join
- Excalidraw teacher canvas
- XP-Pen/stylus manual verification
- Socket.IO room join
- live board sync teacher -> students
- current scene bootstrap for late joiners
- student read-only enforcement
- independent student pan/zoom
- follow teacher / leave follow / return
- student count
- basic anonymous doubt submission
- rate limiting
- teacher doubt queue
- final board save

## P1 — demo quality

- profanity/noise rules
- same-doubt voting
- AI relevance triage
- duplicate suggestion
- export final board as image/PDF
- class history page
- graceful reconnect UX
- error toasts and empty states

## P2 — after MVP

- bookmarks
- periodic board snapshots
- rewind/timeline
- confusion pulse (“I’m confused”)
- AI generated structured notes
- question clustering using embeddings
- teacher analytics

## Explicitly deferred

- multi-writer canvas
- student annotations on shared board
- handwriting recognition during the live stroke path
- audio transcription
- video
- attendance verification
- paid plans
- organization/college tenant administration

## Gate rule

Do not start P1 until all P0 acceptance tests pass in two student tabs plus one teacher tab.
