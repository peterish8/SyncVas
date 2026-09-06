/** Anonymous doubt submission, queue, resolution, and one-vote semantics. */

import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireLocalDevSessionOwner, requireLocalDevSessionOwnerQuery, requireSessionOwner } from "./auth";
import { deterministicScreen } from "./moderation";
import { DOUBT_MAX_CHARS, DOUBT_RATE_LIMIT_MAX, DOUBT_RATE_LIMIT_WINDOW_MS } from "../shared/constants/limits";

const triageDoubt = (internal as unknown as {
  [key: string]: {
    triageDoubt: FunctionReference<
      "action",
      "internal",
      { doubtId: Id<"doubts">; text: string; sessionId: string },
      unknown
    >;
  };
})["internal/moderation"].triageDoubt;

function normalize(text: string): string {
  return text.trim().replace(/\s+/gu, " ").toLowerCase();
}

/** One deterministic policy, shared with the moderation module so the two cannot drift. */
function screening(text: string): { status: "rejected" | "accepted"; reasonCode?: string } {
  const result = deterministicScreen(text);
  return result.outcome === "reject"
    ? { status: "rejected", reasonCode: result.reasonCode }
    : { status: "accepted" };
}

export const submit = mutation({
  args: { sessionId: v.id("sessions"), participantId: v.id("participants"), text: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "live") throw new Error("SESSION_NOT_LIVE: Doubts are closed for this room.");
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.sessionId !== session._id) throw new Error("FORBIDDEN: Participant is not admitted to this room.");
    if (args.text.length > DOUBT_MAX_CHARS) throw new Error("DOUBT_TOO_LONG: Keep the doubt to 220 characters.");

    const now = Date.now();
    const recent = await ctx.db.query("doubts").withIndex("by_participant_created", (q) => q.eq("participantId", participant._id)).order("desc").take(DOUBT_RATE_LIMIT_MAX);
    const withinWindow = recent.filter((d) => now - d.createdAt < DOUBT_RATE_LIMIT_WINDOW_MS);
    if (withinWindow.length >= DOUBT_RATE_LIMIT_MAX) throw new Error("DOUBT_RATE_LIMITED: Please wait before sending another doubt.");

    const normalizedText = normalize(args.text);
    const duplicate = await ctx.db.query("doubts").withIndex("by_session_created", (q) => q.eq("sessionId", session._id)).order("desc").take(100);
    const duplicateOf = duplicate.find((d) => d.normalizedText === normalizedText && d.status !== "rejected");
    const result = screening(args.text);
    const doubtId = await ctx.db.insert("doubts", {
      sessionId: session._id,
      participantId: participant._id,
      text: args.text.trim(),
      normalizedText,
      status: result.status,
      reasonCode: result.reasonCode,
      duplicateOf: duplicateOf?._id,
      voteCount: 0,
      createdAt: now,
    });
    await ctx.db.patch(participant._id, { doubtCount: participant.doubtCount + 1, lastSeenAt: now });
    // Cost protection (docs/14): deterministic rejects never reach a provider.
    if (result.status === "accepted") {
      await ctx.scheduler.runAfter(0, triageDoubt, {
        doubtId,
        text: args.text.trim(),
        sessionId: session._id,
      });
    }
    return { doubtId, status: result.status, reasonCode: result.reasonCode, duplicateOf: duplicateOf?._id };
  },
});

export const listTeacherQueue = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionOwner(ctx, args.sessionId);
    const rows = await ctx.db.query("doubts").withIndex("by_session_status_created", (q) => q.eq("sessionId", args.sessionId).eq("status", "accepted")).order("desc").take(100);
    const uncertain = await ctx.db.query("doubts").withIndex("by_session_status_created", (q) => q.eq("sessionId", args.sessionId).eq("status", "uncertain")).order("desc").take(100);
    return [...rows, ...uncertain].sort((a, b) => b.voteCount - a.voteCount || a.createdAt - b.createdAt).map((d) => ({
      doubtId: d._id, text: d.text, status: d.status, voteCount: d.voteCount, reasonCode: d.reasonCode, duplicateOf: d.duplicateOf, createdAt: d.createdAt,
    }));
  },
});

export const listOpen = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "live") return [];
    const rows = await ctx.db.query("doubts").withIndex("by_session_created", (q) => q.eq("sessionId", args.sessionId)).order("desc").take(50);
    return rows.filter((d) => d.status === "accepted" || d.status === "uncertain").map((d) => ({ doubtId: d._id, text: d.text, voteCount: d.voteCount, status: d.status }));
  },
});

export const listTeacherQueueAsLocalTeacher = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireLocalDevSessionOwnerQuery(ctx, args.sessionId);
    const rows = await ctx.db.query("doubts").withIndex("by_session_created", (q) => q.eq("sessionId", args.sessionId)).order("desc").take(100);
    return rows.filter((d) => d.status === "accepted" || d.status === "uncertain").sort((a, b) => b.voteCount - a.voteCount || a.createdAt - b.createdAt).map((d) => ({ doubtId: d._id, text: d.text, status: d.status, voteCount: d.voteCount, reasonCode: d.reasonCode, duplicateOf: d.duplicateOf, createdAt: d.createdAt }));
  },
});

export const vote = mutation({
  args: { doubtId: v.id("doubts"), participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const doubt = await ctx.db.get(args.doubtId);
    const participant = await ctx.db.get(args.participantId);
    if (!doubt || !participant || doubt.sessionId !== participant.sessionId) throw new Error("FORBIDDEN: Vote is not valid for this room.");
    if (doubt.status !== "accepted" && doubt.status !== "uncertain") throw new Error("DOUBT_NOT_VOTABLE: This doubt is no longer open.");
    const existing = await ctx.db.query("doubtVotes").withIndex("by_doubt_participant", (q) => q.eq("doubtId", doubt._id).eq("participantId", participant._id)).unique();
    if (existing) throw new Error("VOTE_ALREADY_CAST: You already marked this doubt.");
    await ctx.db.insert("doubtVotes", { sessionId: doubt.sessionId, doubtId: doubt._id, participantId: participant._id, createdAt: Date.now() });
    await ctx.db.patch(doubt._id, { voteCount: doubt.voteCount + 1 });
    return { voteCount: doubt.voteCount + 1 };
  },
});

export const resolve = mutation({
  args: { doubtId: v.id("doubts"), action: v.union(v.literal("answered"), v.literal("dismissed")) },
  handler: async (ctx, args) => {
    const doubt = await ctx.db.get(args.doubtId);
    if (!doubt) throw new Error("NOT_FOUND: Doubt not found.");
    await requireSessionOwner(ctx, doubt.sessionId);
    await ctx.db.patch(doubt._id, { status: args.action, resolvedAt: Date.now() });
    return { doubtId: doubt._id, status: args.action };
  },
});

export const resolveAsLocalTeacher = mutation({
  args: { doubtId: v.id("doubts"), action: v.union(v.literal("answered"), v.literal("dismissed")) },
  handler: async (ctx, args) => {
    const doubt = await ctx.db.get(args.doubtId);
    if (!doubt) throw new Error("NOT_FOUND: Doubt not found.");
    await requireLocalDevSessionOwner(ctx, doubt.sessionId);
    await ctx.db.patch(doubt._id, { status: args.action, resolvedAt: Date.now() });
    return { doubtId: doubt._id, status: args.action };
  },
});
