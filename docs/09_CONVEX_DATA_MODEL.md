# 09 — Convex Data Model

This is the target schema, not literal copy-paste. Adjust validators to installed Convex APIs.

## `users`

Teacher account/profile.

Fields:
- `authSubject: string`
- `email?: string`
- `name?: string`
- `role: "teacher" | "admin"`
- `createdAt: number`

Indexes:
- `by_auth_subject`

## `classes`

Reusable course/class grouping.

Fields:
- `teacherId: Id<"users">`
- `title: string`
- `subject?: string`
- `archivedAt?: number`

Indexes:
- `by_teacher`

## `sessions`

One live lecture.

Fields:
- `teacherId`
- `classId?`
- `title`
- `subject?`
- `joinCode`
- `status: "draft" | "live" | "ending" | "ended"`
- `startedAt?`
- `endedAt?`
- `latestBoardVersion: number`
- `latestSnapshotId?`
- `currentTopicSummary?`

Indexes:
- `by_join_code`
- `by_teacher_status`
- `by_teacher_started`

## `participants`

Pseudonymous student session identity.

Fields:
- `sessionId`
- `anonymousIdHash`
- `joinedAt`
- `lastSeenAt`
- `blockedUntil?`
- `doubtCount`

Indexes:
- `by_session_anonymous`
- `by_session`

Do not store a real student name/email for MVP.

## `doubts`

Fields:
- `sessionId`
- `participantId`
- `text`
- `normalizedText`
- `status: "screening" | "accepted" | "uncertain" | "rejected" | "answered" | "dismissed" | "merged"`
- `reasonCode?`
- `relevanceScore?`
- `spamScore?`
- `duplicateOf?`
- `voteCount`
- `createdAt`
- `resolvedAt?`

Indexes:
- `by_session_status_created`
- `by_session_created`
- `by_participant_created`

## `doubtVotes`

Fields:
- `sessionId`
- `doubtId`
- `participantId`
- `createdAt`

Indexes:
- unique behavior enforced in mutation using `by_doubt_participant`

## `boardSnapshots`

Fields:
- `sessionId`
- `boardVersion`
- `sceneJsonStorageId?`
- `sceneJsonCompressed?` only if safely within document limits
- `previewStorageId?`
- `kind: "periodic" | "final"`
- `createdAt`

Indexes:
- `by_session_version`
- `by_session_created`

Prefer file storage for large scene JSON rather than forcing large scene payloads into one Convex document.

## `exports`

Fields:
- `sessionId`
- `type: "board-pdf" | "notes-pdf" | "png"`
- `status: "queued" | "processing" | "ready" | "failed"`
- `storageId?`
- `errorCode?`
- `createdAt`
- `completedAt?`

## `moderationEvents`

Keep operational decision metadata, not unnecessary raw copies of student text.

Fields:
- `sessionId`
- `doubtId?`
- `participantId`
- `decision`
- `reasonCode`
- `model?`
- `latencyMs?`
- `createdAt`

## `boardTemplates`

Phase 11. Teacher-owned reusable starting boards. Not a `boardSnapshots` row — snapshots belong
to one session, templates outlive sessions. Shares the snapshot scene validator, not the table.

Fields:
- `teacherId: Id<"users">`
- `title`, `subject?`
- `sceneJson: string`
- `blockSources?: string`
- `origin: "authored" | "ai-assisted"`
- `createdAt`, `updatedAt`

Indexes:
- `by_teacher_updated` — `["teacherId", "updatedAt"]`

See `docs/33_PREPARED_BOARDS_AND_TEMPLATES.md`.

## `quizQuestions`

Phase 13. One model for both presentations. `correctIndex` is server-only and must never
appear in a student-facing projection.

Fields:
- `sessionId`, `order`
- `kind: "mcq" | "truefalse"`
- `presentation: "board" | "fullscreen"`
- `prompt`, `options: string[]`
- `correctIndex: number` — server-only
- `status: "hidden" | "revealed" | "closed"`
- `anchorX?`, `anchorY?`
- `revealedAt?`, `closedAt?`, `windowMs?`

Indexes:
- `by_session_order` — `["sessionId", "order"]`

## `quizAnswers`

Fields:
- `sessionId`, `questionId`, `participantId`
- `choiceIndex`, `isCorrect`, `points`
- `answeredAt`, `elapsedMs`

Indexes:
- `by_question_participant` — `["questionId", "participantId"]` (one answer per participant,
  same shape as `doubtVotes.by_doubt_participant`)

## `quizScores`

Patched in the same mutation as the answer, so the leaderboard is an indexed read rather than
a scan over every answer.

Fields:
- `sessionId`, `participantId`, `displayName`
- `points`, `correctCount`, `totalMs`

Indexes:
- `by_session_points` — `["sessionId", "points"]`

See `docs/35_QUIZ_AND_LEADERBOARD.md`.

## Additions to existing tables

- `participants.displayName?: string` — supplied at join, screened by `deterministicScreen()`.
  Never shown in the doubts queue.
- `sessions.roomMode: "board" | "quiz-locked"` — drives locked full-screen quiz mode. Convex
  rather than a socket event, so a mid-quiz refresh returns to the quiz.

## Index rule

Every production query should be designed around an index. Avoid `.filter()` over large database query results when an index can express the lookup.
