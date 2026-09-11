/**
 * @phase 24 (COST-02)
 * One-time counter backfill.
 *
 * Phase 24 denormalized `sessions.studentCount` and `quizQuestions.answerCount` /
 * `correctCount`. Rows written before that deploy have the fields absent, and every
 * read site treats absent as 0 — correct for a fresh room, wrong for a room that
 * already has participants or answers.
 *
 * Run once per environment after deploying phase 24:
 *   npx convex run internal/backfillCounts:sessions
 *   npx convex run internal/backfillCounts:quizQuestions
 * and keep passing the returned cursor until `isDone` is true.
 *
 * Both functions recompute from the child rows, so re-running is safe and converges.
 * They are the one place a collect over children is correct: bounded batches, run
 * offline, never on a reactive path.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const DEFAULT_BATCH = 50;
const MAX_BATCH = 200;

function batchSize(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_BATCH;
  if (!Number.isInteger(requested) || requested < 1) return DEFAULT_BATCH;
  return Math.min(requested, MAX_BATCH);
}

const ARGS = {
  cursor: v.optional(v.string()),
  batchSize: v.optional(v.number()),
} as const;

export const sessions = internalMutation({
  args: ARGS,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("sessions")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize(args.batchSize) });

    let patched = 0;
    for (const session of page.page) {
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      if (session.studentCount !== participants.length) {
        await ctx.db.patch(session._id, { studentCount: participants.length });
        patched += 1;
      }
    }

    return {
      scanned: page.page.length,
      patched,
      isDone: page.isDone,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const quizQuestions = internalMutation({
  args: ARGS,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("quizQuestions")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize(args.batchSize) });

    let patched = 0;
    for (const question of page.page) {
      const answers = await ctx.db
        .query("quizAnswers")
        .withIndex("by_question_participant", (q) => q.eq("questionId", question._id))
        .collect();
      const answerCount = answers.length;
      const correctCount = answers.filter((answer) => answer.isCorrect).length;
      if (question.answerCount !== answerCount || question.correctCount !== correctCount) {
        await ctx.db.patch(question._id, { answerCount, correctCount });
        patched += 1;
      }
    }

    return {
      scanned: page.page.length,
      patched,
      isDone: page.isDone,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});
