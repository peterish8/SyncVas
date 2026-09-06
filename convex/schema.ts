/**
 * @phase 1 (FOUND-02 done)
 * Full v1 tables/indexes. Later phases add functions, not raw HF pen streams.
 * Phase 3: sessions/participants mutations. Phase 5: doubts/votes.
 * Phase 6: boardSnapshots finalization. Phase 7: moderationEvents.
 * Phase 8: exports job rows.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authSubject: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    role: v.union(v.literal("teacher"), v.literal("admin")),
    createdAt: v.number(),
  }).index("by_auth_subject", ["authSubject"]),

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
    currentTopicSummary: v.optional(v.string()),
  })
    .index("by_join_code", ["joinCode"])
    .index("by_teacher_status", ["teacherId", "status"])
    .index("by_teacher_started", ["teacherId", "startedAt"]),

  participants: defineTable({
    sessionId: v.id("sessions"),
    anonymousIdHash: v.string(),
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
    .index("by_participant_created", ["participantId", "createdAt"]),

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
});
