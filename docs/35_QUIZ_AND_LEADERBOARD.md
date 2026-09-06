# 35 — Quiz and Leaderboard

Phases 13–15. Requirements QUIZ-01..08, LEAD-01..05.

## Goal

Interactive in-class questions in two presentations, sharing one data model, one answer path
and one leaderboard:

- **Board mode** — question cards anchored on the canvas, hidden until the teacher reveals
  them. Students roam the board to find the answer, then tap an option.
- **Locked mode** — the room switches to a full-screen quiz, canvas interaction disabled.

Both can be used in the same class. The only difference between them is a `presentation` field.

## Transport rule

Everything here runs on **Convex**, not Socket.IO. Reveal, room lock and scoring happen a
handful of times per class, must survive a refresh, and must be authorized. That is durable
low-frequency state. The quiz subsystem adds **zero socket events and no relay changes**.

The one exception: when a board-mode question is revealed, the *teacher's* client compiles the
prompt into elements and publishes a normal `board:update`. The teacher-only-writer rule holds
and students gain no write capability.

## Security model — the requirement most likely to be got wrong

A blurred question on the canvas is **not** hidden. The scene is broadcast to every student, so
anything in it is already in their browser and readable from devtools.

Therefore:
- The board carries only an **anchor card**: a placeholder element whose `customData` holds a
  question id and nothing else
- Prompt and options are served by a Convex query only when `status !== "hidden"`
- `correctIndex` never appears in any student-facing projection, at any status
- Grading happens inside the mutation, server-side

```ts
// Student projection. correctIndex is absent from the return type,
// so it cannot leak by a later careless edit.
return rows.map((q) => q.status === "hidden"
  ? { questionId: q._id, order: q.order, status: q.status }
  : { questionId: q._id, order: q.order, status: q.status,
      kind: q.kind, prompt: q.prompt, options: q.options });
```

**Acceptance is a network check, not a visual one:** inspect the student's query response for a
hidden question and confirm prompt, options and answer key are absent.

## Participant display names

`participants` gains `displayName?: string`, supplied at join.

- Screened by `deterministicScreen()` from `convex/moderation.ts` before storage
- Length-bounded; rejected names re-prompt rather than silently substituting
- **The doubts queue never shows it.** Doubt anonymity is what protects a shy student asking a
  question, and it is unchanged by this feature. Display names exist for leaderboards only.
- Known accepted risk: a student may impersonate a name. Teacher can rename or remove a
  participant from the leaderboard.

## `quizQuestions`

Fields:
- `sessionId: Id<"sessions">`
- `order: number`
- `kind: "mcq" | "truefalse"`
- `presentation: "board" | "fullscreen"`
- `prompt: string`
- `options: string[]`
- `correctIndex: number` — server-only
- `status: "hidden" | "revealed" | "closed"`
- `anchorX?: number`, `anchorY?: number` — board mode
- `revealedAt?: number`, `closedAt?: number`
- `windowMs?: number` — scoring window, defaults to a per-session value

Indexes:
- `by_session_order` — `["sessionId", "order"]`

## `quizAnswers`

Fields:
- `sessionId`, `questionId`, `participantId`
- `choiceIndex: number`
- `isCorrect: boolean`
- `answeredAt: number`, `elapsedMs: number`
- `points: number`

Indexes:
- `by_question_participant` — `["questionId", "participantId"]`

One answer per participant per question, enforced exactly like `doubtVotes.by_doubt_participant`.
A second submission returns `ANSWER_ALREADY_CAST`.

## `quizScores`

Fields:
- `sessionId`, `participantId`, `displayName: string`
- `points: number`, `correctCount: number`, `totalMs: number`

Indexes:
- `by_session_points` — `["sessionId", "points"]`

Patched in the same mutation that writes the answer. This is deliberate denormalization: both
writes are in one transaction so they cannot drift, and it turns the leaderboard from a scan
over every answer into an indexed descending read. With ~100 students holding live leaderboard
subscriptions, deriving on read would mean 100 recomputes per submitted answer.

## Scoring

Speed is a first-class part of the score, not just a tiebreak.

```
elapsed = clamp(answeredAt - revealedAt, 0, windowMs)
points  = isCorrect ? round(BASE * (1 - 0.5 * elapsed / windowMs)) : 0
```

- `BASE` = 1000, `windowMs` default 30 000
- A correct answer at t=0 scores 1000; at the window edge it scores 500
- The 50% floor is intentional: it rewards speed without making a considered correct answer
  worthless, so the incentive is not to guess fast
- Incorrect answers score zero regardless of speed
- Answers after `closed` are rejected, not scored zero

Rank by `points` descending, ties broken by `totalMs` ascending.

## Room lock

`sessions` gains `roomMode: "board" | "quiz-locked"`.

The student shell already subscribes to session state. When `roomMode` flips it swaps the board
for the full-screen quiz and stops rendering canvas controls. Because this is Convex state
rather than an ephemeral signal, a student who refreshes mid-quiz returns to the quiz instead of
a stale board — the failure an ephemeral event would have.

## Late joiners

A student joining after a question was revealed can see it but scores zero once it is closed.
Simple, explainable to a room, and needs no retroactive grading.

## End of class

`sessions.end` already refuses to finalize without a snapshot. Quiz finalization additionally:
- Closes any question still `revealed`
- Freezes the leaderboard into the ended session
- Includes results in teacher history and the export path
- Is a no-op for a class that ran no quiz — an empty quiz must never block finalization

## Functions

Teacher, owner-checked:
- `quiz.createQuestion`, `quiz.updateQuestion`, `quiz.removeQuestion`
- `quiz.reveal(questionId)`, `quiz.close(questionId)`
- `quiz.setRoomMode(sessionId, mode)`
- `quiz.listForTeacher(sessionId)` — includes `correctIndex` and live answer counts
- `quiz.leaderboard(sessionId, questionId?)`

Student, participant-checked:
- `quiz.listForStudent(sessionId)` — redacted projection above
- `quiz.submitAnswer(questionId, participantId, choiceIndex)`
- `quiz.myStanding(sessionId, participantId)`

## Failure modes

| Case | Behavior |
|------|----------|
| Answer submitted twice | `ANSWER_ALREADY_CAST` |
| Answer to a hidden question | `QUESTION_NOT_OPEN`; no information disclosed about the question |
| Answer after close | `QUESTION_CLOSED`, not a zero-score row |
| Answer from a participant in another session | `FORBIDDEN` |
| Reveal by a non-owner | `FORBIDDEN` |
| Class ends mid-question | Question closed, leaderboard frozen |
| Class ran no quiz | Finalization unchanged |
| Display name fails screening | Rejected at join with a re-prompt |

## Acceptance

1. Teacher authors an MCQ and a true/false question, one board-anchored and one full-screen, in one class
2. Before reveal, the student network response contains no prompt, no options and no answer key
3. Reveal places the question on the board; students see it and answer from the dock
4. A second answer from the same participant is rejected
5. A fast correct answer outscores a slow correct answer; an incorrect answer scores zero
6. Student opens the leaderboard mid-class and sees their standing; teacher projects it
7. Locking the room disables canvas interaction; a student refresh returns to the quiz
8. Ending the class freezes results into history alongside the final board
