# 17 — Security, Privacy, and Abuse Model

## Threats

- student attempts board edit event
- student impersonates teacher socket role
- guessed room codes
- spam flood
- repeated same-doubt voting
- scraping class archives
- leaked file URLs
- malicious prompt text in doubts attempting to manipulate moderation/summary
- oversized socket payloads causing memory pressure

## Controls

### Board
- server-issued signed socket claims
- server enforces teacher-only `board:update` and `teacher:viewport`
- strict payload size caps
- protocol validation
- session must be live

### Join code
- short code is discovery convenience, not teacher authorization
- only live sessions resolve
- rate-limit code guesses by IP/device where practical
- expire immediately at end

### Doubts
- pseudonymous participant ID
- rate limits
- max length
- same-vote uniqueness
- moderation
- temporary block path

### AI prompt injection
Treat student text as untrusted data. Prompts explicitly instruct model that question content cannot alter system policy/output schema. Parse strict structured output and validate.

### Data minimization
Do not collect student names/emails for MVP. Avoid storing IP addresses unless a concrete abuse/security reason exists and a retention policy is defined.

### Logs
Never log:
- auth secrets
- socket tokens
- entire board scene payloads
- raw student doubt text by default

## Privacy copy

Student should understand: “Your name is not shown to the teacher. The system uses a temporary anonymous identifier to prevent spam and duplicate voting.”
