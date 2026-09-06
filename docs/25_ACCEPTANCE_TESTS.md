# 25 — Acceptance Tests / Definition of Done

## Classroom lifecycle

- [ ] authenticated teacher creates room
- [ ] unique short code generated
- [ ] QR joins same room
- [ ] ended room rejects new joins

## Board

- [ ] XP-Pen can write naturally in supported desktop browser
- [ ] teacher sees local stroke immediately independent of network roundtrip
- [ ] two students receive board update
- [ ] late student gets latest board without historical replay
- [ ] student cannot emit a valid board mutation even by calling socket event manually
- [ ] refresh/reconnect restores latest board

## Navigation/follow

- [ ] Student A pan does not alter Student B or teacher
- [ ] Follow Teacher mirrors teacher viewport
- [ ] student manual navigation exits follow
- [ ] Return to Teacher resumes follow
- [ ] viewport packet loss does not corrupt board

## Doubts

- [ ] no student name shown to teacher
- [ ] participant is still pseudonymously rate-limited
- [ ] repeated spam hits rate limit
- [ ] one participant cannot vote same doubt twice
- [ ] teacher can mark answered
- [ ] unrelated AI classification failure does not silently lose a plausible doubt

## Security

- [ ] student socket cannot impersonate teacher by changing client role field
- [ ] session ownership checked in Convex
- [ ] cross-room socket leakage test passes
- [ ] secrets absent from browser bundle

## End class

- [ ] final scene persists
- [ ] class appears in teacher history
- [ ] export job has visible state
- [ ] failure of AI summary does not lose board

## Load

- [ ] one teacher + 100 viewers smoke/load test completed with documented results
