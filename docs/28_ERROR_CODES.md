# SyncVas error codes

| Code | Meaning | User recovery |
|---|---|---|
| `UNAUTHORIZED` | No valid room token | Reconnect or join again |
| `TOKEN_EXPIRED` | Existing socket token expired | Request a fresh token and reconnect |
| `WRITER_ALREADY_ACTIVE` | Another teacher owns the room writer lease | Close the duplicate teacher tab |
| `ROOM_MISMATCH` | Payload room differs from signed room | Reload the correct room |
| `STUDENT_BOARD_EDIT_FORBIDDEN` | Student attempted board mutation | Continue in read-only mode |
| `STALE_BOARD_VERSION` | Update is older than canonical scene | Request `board:current` |
| `SESSION_NOT_LIVE` | Room is draft, ending, or ended | Ask the teacher for a live code |
| `DOUBT_RATE_LIMITED` | Participant sent too many recent doubts | Wait and try again |
| `FINAL_BOARD_REQUIRED` | Export requested without final snapshot | End and save the class first |
| `EXPORT_GENERATION_FAILED` | Export worker could not generate output | Retry without affecting the saved board |
