# 04 — User Flows

## Teacher: first class

1. Sign in.
2. Dashboard -> `Start class`.
3. Enter optional title/subject.
4. Session created.
5. Classroom page shows QR, six-character code, participant count.
6. Teacher dismisses join overlay and writes.
7. Doubt badge appears only when accepted doubts exist.
8. Teacher opens queue, reads/answers, marks answered.
9. Teacher selects `End class`.
10. Confirmation warns that join code will stop accepting students.
11. Board is persisted and class moves to history.

## Student: QR join

1. Scan QR.
2. `/join/{code}` resolves live session.
3. Anonymous participant token created/reused for this session.
4. Student enters viewer.
5. Current board snapshot loads.
6. Live updates begin.
7. Student can pan/zoom freely.
8. Student taps Follow Teacher.
9. Teacher camera movements mirror locally.
10. Student manually pans -> follow ends -> “Return to Teacher” appears.

## Student: doubt

1. Tap `Ask doubt`.
2. Enter text.
3. UI shows character limit and anonymous notice.
4. Submit.
5. Backend checks rate, format, noise, duplicate, relevance.
6. Outcome:
   - accepted -> confirmation
   - merged/similar -> offer/record same-doubt
   - rate limited -> countdown
   - unrelated/noise -> explain briefly and allow edit
   - uncertain -> accepted into low-priority queue

## Reconnect

1. Socket disconnects.
2. Student UI shows small “Reconnecting…” state without blocking pan/zoom.
3. On reconnect, client requests canonical board version.
4. If local version mismatches, replace with latest scene.
5. Follow mode resumes only if it was on and user did not manually navigate during outage.
