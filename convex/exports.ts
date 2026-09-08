/** Owner-authorized export jobs sourced from the durable final scene. */

import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireSessionOwner } from "./permissions";
import { fail } from "./errors";

const processExport = (internal as unknown as {
  [key: string]: { processNext: FunctionReference<"action", "internal", { exportId: Id<"exports"> }, unknown> };
})["internal/exportJobs"].processNext;

export const request = mutation({
  args: { sessionId: v.id("sessions"), type: v.union(v.literal("board-pdf"), v.literal("notes-pdf"), v.literal("png")) },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    if (session.status !== "ended" || !session.latestSnapshotId) fail("FINAL_BOARD_REQUIRED", "End the class before exporting.");
    const exportId = await ctx.db.insert("exports", { sessionId: session._id, type: args.type, status: "queued", createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, processExport, { exportId });
    return { exportId, status: "queued" as const };
  },
});

export const getForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionOwner(ctx, args.sessionId);
    return await ctx.db.query("exports").withIndex("by_session_created", (q) => q.eq("sessionId", args.sessionId)).order("desc").take(20);
  },
});

export const markProcessing = internalMutation({
  args: { exportId: v.id("exports") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.exportId);
    if (!job || job.status !== "queued") return null;
    await ctx.db.patch(job._id, { status: "processing" });
    return job;
  },
});

export const markReady = internalMutation({
  args: { exportId: v.id("exports"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.exportId);
    if (!job) return null;
    await ctx.db.patch(job._id, { status: "ready", storageId: args.storageId, completedAt: Date.now() });
    return { ok: true };
  },
});

export const markFailed = internalMutation({
  args: { exportId: v.id("exports"), errorCode: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.exportId);
    if (!job) return null;
    await ctx.db.patch(job._id, { status: "failed", errorCode: args.errorCode, completedAt: Date.now() });
    return { ok: true };
  },
});
