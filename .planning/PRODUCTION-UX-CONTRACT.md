# Production UX Contract

Source plan: SyncVas Production UI/UX & Frontend Flow Plan.  
Principles: IxDF (personas/journeys) + UX Design Institute (edge cases, error states, a11y, copy).

## Personas

| Persona | Job | Success |
| --- | --- | --- |
| Teacher (Priya) | Start fast, teach with stylus, glance at doubts, end with a saved board | Dashboard → New class → Live → End → Export/Summary → History |
| Student (Arjun) | Join in &lt;10s, follow or free-roam, ask anonymously, get post-class notes | Code/QR → Live board → clear Follow/doubt feedback → notes when ended |

## Copy glossary

| Term in UI | Meaning |
| --- | --- |
| Live | Session accepts joins; board syncs |
| Ending | Final board is being saved; joins stop |
| Ended | Class finished; board durable |
| Connecting… | Socket joining / reconnecting |
| Offline | Socket disconnected; retry available |
| Following | Student camera mirrors teacher viewport |
| Free roam | Student local pan/zoom; follow off |
| Same doubt | Another student marked “same question” |
| Summary pending | AI notes still generating (does not undo End Class) |

## Error → UI matrix

| Code | User message | Recovery |
| --- | --- | --- |
| `INVALID_JOIN_CODE` / `SESSION_NOT_FOUND` | Check the six-character code and try again. | Edit code / ask teacher |
| `SESSION_NOT_LIVE` | That class is not open yet. | Wait for teacher to start |
| `SESSION_ENDED` | That class has ended. Ask the teacher for a new code. | Home / wait for new class |
| `DOUBT_RATE_LIMITED` | Please wait a moment before sending another doubt. | Wait and retry |
| `MODERATION_REJECTED` / noise reject | That message was filtered. Try a clearer question. | Rewrite |
| `STALE_BOARD_VERSION` | (Silent resync / request current) | Automatic |
| `UNAUTHORIZED` / `TOKEN_EXPIRED` | Connection expired. Reconnecting… | Reconnect / rejoin |
| `EXPORT_GENERATION_FAILED` | Export failed. Your board is still saved. | Retry export |
| `SUMMARY_*` | Use hints in teacher notes panel | Retry / skip |

Raw codes never appear as the primary UI string.

## Navigation IA

- **Teacher:** Dashboard ↔ Live classroom (`/teacher`) ↔ History
- **Student:** Join → Room → Notes (when session ended / summary available)
- **Marketing:** Start teaching → `/teacher` (or sign-in); Join a class → `/join`

## Non-goals (MVP)

No chat, student cursors, multi-writer board, invasive analytics, or agentic AI that blocks End Class.

## Phase exit rule

A path is done when teacher + student tabs can complete happy path and the named failure path with visible recovery — verified in browser, not screenshot-only.
