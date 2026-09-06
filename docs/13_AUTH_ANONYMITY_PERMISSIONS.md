# 13 — Authentication, Anonymity, and Permissions

## Teacher

Teacher must authenticate to create/manage sessions. Wrap auth behind helpers such as:
- `requireTeacher(ctx)`
- `requireSessionOwner(ctx, sessionId)`

The teacher entry page is `/teacher/sign-in`. It contains the Google provider-ready access surface
and a clearly labelled local-development continuation. Google OAuth is intentionally not enabled
until `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and the matching callback origin are supplied; the
disabled provider control must not be presented as a working production login. Local teacher mode
is only a development bootstrap and must remain gated by `ALLOW_DEV_TEACHER=1`.

Convex Auth may be used for prototype but is beta; do not scatter provider-specific assumptions throughout features.

## Student

No account required in MVP.

Create a cryptographically random browser-held anonymous secret for the session. Send only a hash/derived identifier to durable storage where practical. The backend maps it to a participant record.

Teacher UI never receives the raw pseudonymous participant identifier unless needed for aggregate operations.

## Socket authorization

Joining by code is not enough to gain socket permissions. Backend issues a short-lived signed socket token after validating live session + participant/teacher role.

## Permission matrix

| Action | Teacher | Student |
|---|---:|---:|
| Create/end session | yes | no |
| Draw/edit board | yes | no |
| Broadcast viewport | yes | no |
| View board | yes | yes |
| Pan/zoom own view | yes | yes |
| Submit doubt | optional/no | yes |
| Vote same doubt | optional/no | yes |
| Resolve doubt | yes | no |
| Download class artifact | yes | yes if session policy permits |

## Abuse controls

Anonymous does not mean unbounded. Participant record enables:
- rate limiting
- duplicate vote prevention
- temporary blocks
- abuse counter

Do not reveal participant identity to teacher merely because moderation triggers.
