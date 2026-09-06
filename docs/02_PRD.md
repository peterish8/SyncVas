# 02 — Product Requirements Document (PRD)

## Objective

Ship a web application for live classroom whiteboard teaching where a teacher writes with a stylus/XP-Pen and students join the exact board through a QR/code, without being able to edit it.

## Primary jobs to be done

### Teacher
- Start a class in under 15 seconds after opening the product.
- Write naturally using pen/stylus.
- Know how many students are connected.
- See only useful, compact doubts while teaching.
- Mark a doubt answered/dismissed.
- End class and preserve the board.

### Student
- Join in under 10 seconds without creating an account.
- View the latest board state.
- Pan/zoom independently.
- Tap Follow Teacher to mirror teacher viewport.
- Leave follow automatically by manually navigating.
- Return to teacher instantly.
- Ask a doubt anonymously.
- See whether their doubt was accepted, merged, rate-limited, or rejected as unrelated/spam.
- Access the saved class artifact after class.

## Functional requirements

### Room creation
- Authenticated teacher creates a live session.
- Generate opaque session ID + collision-resistant 6-character display code.
- Generate QR pointing to `/join/{code}`.
- Code expires when session ends and must not be reused immediately.

### Whiteboard
- Excalidraw embedded client-side.
- Stylus/free-draw, eraser, basic shapes, text, undo/redo, pan/zoom.
- Teacher editor mode.
- Student viewer mode; no board mutations accepted by server.

### Realtime
- Teacher board deltas/snapshots broadcast to room through Socket.IO.
- Late joiner receives current canonical scene before incremental updates.
- Teacher viewport broadcasts separately and can be dropped/throttled without corrupting board state.

### Follow
- Off by default unless product test proves otherwise.
- When ON, student camera follows latest teacher viewport.
- Any deliberate student pan/zoom disables follow locally.
- “Return to Teacher” re-enables it.

### Doubts
- Character limit.
- Rate limit per participant/session.
- Rule-based spam/profanity checks.
- Optional semantic duplicate detection.
- AI relevance classification only after cheap checks.
- Teacher sees accepted doubts ordered by score/upvotes/recency.
- Students can mark “same doubt” once per doubt.

### End class
- Session changes `live -> ending -> ended`.
- Final board persisted.
- Export image/PDF job scheduled.
- Optional AI summary job scheduled.

## Non-functional requirements

- Teacher pen interaction should remain responsive even if socket/network is degraded.
- Student board updates should normally appear within a sub-second perceived window on healthy campus Wi-Fi.
- 100 connected students in one room is the initial load-test target.
- No student board edit event can mutate canonical board state.
- Doubt submission should not expose student identity to teacher UI.
- Room codes must not be authorization by themselves for teacher actions.

## Metrics

MVP product metrics:
- room join success rate
- median join time
- student connected count peak
- board sync reconnect count
- doubts submitted / accepted / rejected / merged
- follow-mode activations
- classes ended successfully
- export success rate

Do not add invasive student behavior analytics in MVP.
