/**
 * @phase 1 (FOUND-02 done)
 * Full v1 tables/indexes. Later phases add functions, not raw HF pen streams.
 * Phase 3: sessions/participants mutations. Phase 5: doubts/votes.
 * Phase 6: boardSnapshots finalization. Phase 7: moderationEvents.
 * Phase 8: exports job rows.
 */
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  // Override authTables.users with SyncVas teacher fields + Convex Auth fields.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    authSubject: v.string(),
    role: v.union(v.literal("teacher"), v.literal("admin")),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_auth_subject", ["authSubject"]),

  classes: defineTable({
    teacherId: v.id("users"),
    title: v.string(),
    subject: v.optional(v.string()),
    archivedAt: v.optional(v.number()),
  }).index("by_teacher", ["teacherId"]),

  sessions: defineTable({
    teacherId: v.id("users"),
    classId: v.optional(v.id("classes")),
    title: v.string(),
    subject: v.optional(v.string()),
    joinCode: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("live"),
      v.literal("ending"),
      v.literal("ended"),
    ),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    latestBoardVersion: v.number(),
    latestSnapshotId: v.optional(v.id("boardSnapshots")),
    /** Set when finalization had to close the room without a durable board.
     * A room must always reach "ended" — leaving it in "ending" strands the
     * teacher with no way to export, restart, or recover. See sessions.finalize. */
    finalizeWarning: v.optional(v.string()),
    /** Set when the relay could not be told to evict this room's live sockets.
     * The room is closed in Convex regardless, but sockets admitted before the
     * end may have kept relaying the board until their tokens expired, so the
     * failure is recorded rather than dropped. See internal/revokeRoom. */
    revocationWarning: v.optional(v.string()),
    currentTopicSummary: v.optional(v.string()),
    roomMode: v.optional(v.union(v.literal("board"), v.literal("quiz-locked"))),
    /** Denormalized participant count. Maintained by participants.joinByCode in the
     * same transaction as the insert, so a reactive read costs one document instead
     * of collecting the room. Optional: rows created before phase 24 read as 0 until
     * internal/backfillCounts runs. */
    studentCount: v.optional(v.number()),
  })
    .index("by_join_code", ["joinCode"])
    .index("by_teacher_status", ["teacherId", "status"])
    .index("by_teacher_started", ["teacherId", "startedAt"]),

  participants: defineTable({
    sessionId: v.id("sessions"),
    anonymousIdHash: v.string(),
    displayName: v.optional(v.string()),
    joinedAt: v.number(),
    lastSeenAt: v.number(),
    blockedUntil: v.optional(v.number()),
    doubtCount: v.number(),
  })
    .index("by_session_anonymous", ["sessionId", "anonymousIdHash"])
    .index("by_session", ["sessionId"]),

  doubts: defineTable({
    sessionId: v.id("sessions"),
    participantId: v.id("participants"),
    text: v.string(),
    normalizedText: v.string(),
    status: v.union(
      v.literal("screening"),
      v.literal("accepted"),
      v.literal("uncertain"),
      v.literal("rejected"),
      v.literal("answered"),
      v.literal("dismissed"),
      v.literal("merged"),
    ),
    reasonCode: v.optional(v.string()),
    relevanceScore: v.optional(v.number()),
    spamScore: v.optional(v.number()),
    duplicateOf: v.optional(v.id("doubts")),
    voteCount: v.number(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_session_status_created", ["sessionId", "status", "createdAt"])
    .index("by_session_created", ["sessionId", "createdAt"])
    .index("by_participant_created", ["participantId", "createdAt"])
    // Duplicate detection. Scanning the 100 most recent doubts missed a repeat in a
    // busy room and read 100 documents to do it.
    .index("by_session_normalized", ["sessionId", "normalizedText"]),

  doubtVotes: defineTable({
    sessionId: v.id("sessions"),
    doubtId: v.id("doubts"),
    participantId: v.id("participants"),
    createdAt: v.number(),
  }).index("by_doubt_participant", ["doubtId", "participantId"]),

  boardSnapshots: defineTable({
    sessionId: v.id("sessions"),
    boardVersion: v.number(),
    sceneJsonStorageId: v.optional(v.id("_storage")),
    sceneJsonCompressed: v.optional(v.string()),
    previewStorageId: v.optional(v.id("_storage")),
    kind: v.union(v.literal("periodic"), v.literal("final")),
    createdAt: v.number(),
  })
    .index("by_session_version", ["sessionId", "boardVersion"])
    .index("by_session_created", ["sessionId", "createdAt"]),

  boardAssets: defineTable({
    sessionId: v.id("sessions"),
    fileId: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_session_file", ["sessionId", "fileId"])
    .index("by_session_created", ["sessionId", "createdAt"]),

  exports: defineTable({
    sessionId: v.id("sessions"),
    type: v.union(
      v.literal("board-pdf"),
      v.literal("notes-pdf"),
      v.literal("png"),
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    storageId: v.optional(v.id("_storage")),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_created", ["sessionId", "createdAt"]),

  moderationEvents: defineTable({
    sessionId: v.id("sessions"),
    doubtId: v.optional(v.id("doubts")),
    participantId: v.id("participants"),
    decision: v.string(),
    reasonCode: v.string(),
    model: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_session_created", ["sessionId", "createdAt"])
    .index("by_doubt", ["doubtId"]),

  boardTemplates: defineTable({
    teacherId: v.id("users"),
    title: v.string(),
    subject: v.optional(v.string()),
    sceneJson: v.string(),
    blockSources: v.optional(v.string()),
    origin: v.union(v.literal("authored"), v.literal("ai-assisted")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_teacher_updated", ["teacherId", "updatedAt"]),

  sessionSummaries: defineTable({
    sessionId: v.id("sessions"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    /** Validated SummaryResult JSON. Stored as a string so the notes schema can
     * evolve in lib/ai without a Convex migration. */
    notesJson: v.optional(v.string()),
    boardVersion: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_created", ["sessionId", "createdAt"]),

  quizQuestions: defineTable({
    sessionId: v.id("sessions"),
    order: v.number(),
    kind: v.union(v.literal("mcq"), v.literal("truefalse")),
    presentation: v.union(v.literal("board"), v.literal("fullscreen")),
    prompt: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    status: v.union(v.literal("hidden"), v.literal("revealed"), v.literal("closed")),
    anchorX: v.optional(v.number()),
    anchorY: v.optional(v.number()),
    revealedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    windowMs: v.optional(v.number()),
    /** Denormalized answer tallies, patched in the same transaction as the answer
     * insert. Without these, listForTeacher collects every answer of every question
     * on each re-run. Optional for the same backfill reason as sessions.studentCount. */
    answerCount: v.optional(v.number()),
    correctCount: v.optional(v.number()),
  }).index("by_session_order", ["sessionId", "order"]),

  quizAnswers: defineTable({
    sessionId: v.id("sessions"),
    questionId: v.id("quizQuestions"),
    participantId: v.id("participants"),
    choiceIndex: v.number(),
    isCorrect: v.boolean(),
    answeredAt: v.number(),
    elapsedMs: v.number(),
    points: v.number(),
  }).index("by_question_participant", ["questionId", "participantId"]),

  quizScores: defineTable({
    sessionId: v.id("sessions"),
    participantId: v.id("participants"),
    displayName: v.string(),
    points: v.number(),
    correctCount: v.number(),
    totalMs: v.number(),
  })
    .index("by_session_points", ["sessionId", "points"])
    // submitAnswer resolves one participant's score row; by_session_points would
    // return the whole room.
    .index("by_session_participant", ["sessionId", "participantId"]),
});
