# SyncVas error codes

| Code | Meaning | User recovery |
|---|---|---|
| `UNAUTHORIZED` | No valid room token | Reconnect or join again |
| `TOKEN_EXPIRED` | Existing socket token expired | Request a fresh token and reconnect |
| `WRITER_ALREADY_ACTIVE` | A different teacher owns the room writer lease | Close the duplicate teacher tab |
| `WRITER_REPLACED` | The same teacher opened the board on a newer socket (another tab, or a reconnect), which took over the writer lease; this socket was closed | Keep teaching in the other tab, or reload this one to take the board back |
| `ROOM_MISMATCH` | Payload room differs from signed room | Reload the correct room |
| `ROOM_REVOKED` | The class ended and the relay evicted the room | Leave the board; the class is over (UI shows the "Class ended" panel, no reconnect) |
| `SESSION_ENDED` | Convex refused a join or a fresh room token because the session has ended | Open the class notes or join another class |
| `ROOM_FULL` | Room is at `LIMITS.maxSocketsPerRoom` | Ask the teacher; retry once someone leaves |
| `TOO_MANY_CONNECTIONS` | Address exceeded its concurrent-socket budget, or the tokenless budget is spent | Close unused tabs and reconnect |
| `IDLE_NO_ROOM` | Socket stayed connected without joining a room past the grace period | Reconnect with a room token when actually joining |
| `STUDENT_BOARD_EDIT_FORBIDDEN` | Student attempted board mutation | Continue in read-only mode |
| `STALE_BOARD_VERSION` | Update is older than canonical scene | Request `board:current` |
| `SESSION_NOT_LIVE` | Room is draft, ending, or ended | Ask the teacher for a live code |
| `DOUBT_RATE_LIMITED` | Participant sent too many recent doubts | Wait and try again |
| `FINAL_BOARD_REQUIRED` | Export requested without final snapshot | End and save the class first |
| `EXPORT_GENERATION_FAILED` | Export worker could not generate output | Retry without affecting the saved board |
