/**
 * @phase 12
 * AI board drafting entry point — AIB-01, AIB-02.
 *
 * The call runs as a Convex action so the provider credential stays on the
 * server and the caller is a verified teacher. The model returns grammar source
 * only; compiling and placing it is the client's deterministic job, never the
 * model's.
 */

import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getLocalDevTeacher, requireTeacher } from "./auth";
import {
  boardDraftRequestSchema,
  getBoardAuthoringAdapter,
  type BoardDraftResult,
} from "../lib/ai/board-authoring-adapter";

const DRAFT_ARGS = {
  topic: v.string(),
  subject: v.optional(v.string()),
  detail: v.union(v.literal("light"), v.literal("standard")),
  writingZones: v.number(),
} as const;

export const assertTeacher = internalQuery({
  args: {},
  handler: async (ctx) => {
    const teacher = await requireTeacher(ctx);
    return { teacherId: teacher._id };
  },
});

export const assertLocalTeacher = internalQuery({
  args: {},
  handler: async (ctx) => {
    const teacher = await getLocalDevTeacher(ctx);
    if (!teacher) throw new Error("FORBIDDEN: A teacher account is required.");
    return { teacherId: teacher._id };
  },
});

async function runDraft(args: {
  topic: string;
  subject?: string;
  detail: "light" | "standard";
  writingZones: number;
}): Promise<BoardDraftResult> {
  const parsed = boardDraftRequestSchema.safeParse(args);
  // A malformed request is the caller's problem, but it still must not surface
  // as an error dialog mid-lesson.
  if (!parsed.success) return { status: "unavailable", reason: "provider_invalid" };
  return await getBoardAuthoringAdapter().draft(parsed.data);
}

export const draft = action({
  args: DRAFT_ARGS,
  handler: async (ctx, args): Promise<BoardDraftResult> => {
    await ctx.runQuery(internal.boardAuthoring.assertTeacher, {});
    return await runDraft(args);
  },
});

export const draftAsLocalTeacher = action({
  args: DRAFT_ARGS,
  handler: async (ctx, args): Promise<BoardDraftResult> => {
    await ctx.runQuery(internal.boardAuthoring.assertLocalTeacher, {});
    return await runDraft(args);
  },
});
