/** Anonymous doubt submission, queue, resolution, and one-vote semantics. */

import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireParticipantInSession, requireSessionOwner } from "./permissions";
import { deterministicScreen } from "./moderation";
import { DOUBT_MAX_CHARS, DOUBT_RATE_LIMIT_MAX, DOUBT_RATE_LIMIT_WINDOW_MS } from "../shared/constants/limits";
import { fail } from "./errors";

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

/**
 * How many same-text rows to look at before giving up on finding a live original.
 * Every row here has identical normalized text, so this is not a cap on how far back
 * detection reaches — it only stops a long run of rejected repeats from being unbounded.
 */
const DUPLICATE_LOOKBACK = 10;

/**
 * The triage verdict a duplicate can inherit from its original.
 *
 * Reuses the *verdict*, not the lifecycle: an original the teacher already answered
 * still means "this question passed triage", so the new copy enters the queue as
 * accepted rather than as answered. A `screening` original has no verdict yet, so the
 * copy is triaged normally.
 */
function inheritedVerdict(
  original: Doc<"doubts"> | undefined,
): { status: "accepted" | "uncertain"; reasonCode?: string; relevanceScore?: number } | undefined {
  if (!original) return undefined;
  if (original.status === "accepted" || original.status === "answered") {
    return { status: "accepted", reasonCode: original.reasonCode, relevanceScore: original.relevanceScore };
  }
  if (original.status === "uncertain") {
    return { status: "uncertain", reasonCode: original.reasonCode, relevanceScore: original.relevanceScore };
  }
  return undefined;
}

export const submit = mutation({
  args: { sessionId: v.id("sessions"), participantId: v.id("participants"), text: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "live") fail("SESSION_NOT_LIVE", "Doubts are closed for this room.");
    const participant = await requireParticipantInSession(ctx, session._id, args.participantId);
    if (args.text.length > DOUBT_MAX_CHARS) fail("DOUBT_TOO_LONG", "Keep the doubt to 220 characters.");

    const now = Date.now();
    const recent = await ctx.db.query("doubts").withIndex("by_participant_created", (q) => q.eq("participantId", participant._id)).order("desc").take(DOUBT_RATE_LIMIT_MAX);
    const withinWindow = recent.filter((d) => now - d.createdAt < DOUBT_RATE_LIMIT_WINDOW_MS);
    if (withinWindow.length >= DOUBT_RATE_LIMIT_MAX) fail("DOUBT_RATE_LIMITED", "Please wait before sending another doubt.");

    const normalizedText = normalize(args.text);
    // Indexed on the exact normalized text, so the detection window is the room's whole
    // history rather than its last 100 doubts. The bounded take is over identical text
    // only: it caps a pathological repeat of one rejected phrase, not room traffic.
    const sameText = await ctx.db
      .query("doubts")
      .withIndex("by_session_normalized", (q) =>
        q.eq("sessionId", session._id).eq("normalizedText", normalizedText),
      )
      .order("desc")
      .take(DUPLICATE_LOOKBACK);
    const duplicateOf = sameText.find((d) => d.status !== "rejected");

    const result = screening(args.text);
    // A duplicate of an already-triaged question is the same question, so it inherits
    // that verdict instead of paying for a second provider call (docs/14 cost protection).
    const inherited = result.status === "accepted" ? inheritedVerdict(duplicateOf) : undefined;
    const status = inherited?.status ?? result.status;

    const doubtId = await ctx.db.insert("doubts", {
      sessionId: session._id,
      participantId: participant._id,
      text: args.text.trim(),
      normalizedText,
      status,
      reasonCode: inherited?.reasonCode ?? result.reasonCode,
      relevanceScore: inherited?.relevanceScore,
      duplicateOf: duplicateOf?._id,
      voteCount: 0,
      createdAt: now,
    });
    await ctx.db.patch(participant._id, { doubtCount: participant.doubtCount + 1, lastSeenAt: now });
    // Cost protection (docs/14): deterministic rejects never reach a provider, and
    // neither does a duplicate whose original already has a verdict.
    if (result.status === "accepted" && !inherited) {
      await ctx.scheduler.runAfter(0, triageDoubt, {
        doubtId,
        text: args.text.trim(),
        sessionId: session._id,
      });
    }
    return { doubtId, status, reasonCode: inherited?.reasonCode ?? result.reasonCode, duplicateOf: duplicateOf?._id };
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

/**
 * The student-visible doubt list.
 *
 * Requires proof of admission to *this* room. Without it a bare session ID read
 * out every student's question text, which is exactly the anonymity the product
 * promises. Submit and vote already checked the participant; this read did not.
 */
export const listOpen = query({
  args: { sessionId: v.id("sessions"), participantId: v.id("participants") },
  handler: async (ctx, args) => {
    await requireParticipantInSession(ctx, args.sessionId, args.participantId);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "live") return [];
    const rows = await ctx.db.query("doubts").withIndex("by_session_created", (q) => q.eq("sessionId", args.sessionId)).order("desc").take(50);
    return rows.filter((d) => d.status === "accepted" || d.status === "uncertain").map((d) => ({ doubtId: d._id, text: d.text, voteCount: d.voteCount, status: d.status }));
  },
});

export const vote = mutation({
  args: { doubtId: v.id("doubts"), participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const doubt = await ctx.db.get(args.doubtId);
    if (!doubt) fail("FORBIDDEN", "Vote is not valid for this room.");
    const participant = await requireParticipantInSession(ctx, doubt.sessionId, args.participantId);
    if (doubt.status !== "accepted" && doubt.status !== "uncertain") fail("DOUBT_NOT_VOTABLE", "This doubt is no longer open.");
    const existing = await ctx.db.query("doubtVotes").withIndex("by_doubt_participant", (q) => q.eq("doubtId", doubt._id).eq("participantId", participant._id)).unique();
    if (existing) fail("VOTE_ALREADY_CAST", "You already marked this doubt.");
    await ctx.db.insert("doubtVotes", { sessionId: doubt.sessionId, doubtId: doubt._id, participantId: participant._id, createdAt: Date.now() });
    await ctx.db.patch(doubt._id, { voteCount: doubt.voteCount + 1 });
    return { voteCount: doubt.voteCount + 1 };
  },
});

export const resolve = mutation({
  args: { doubtId: v.id("doubts"), action: v.union(v.literal("answered"), v.literal("dismissed")) },
  handler: async (ctx, args) => {
    const doubt = await ctx.db.get(args.doubtId);
    if (!doubt) fail("NOT_FOUND", "Doubt not found.");
    await requireSessionOwner(ctx, doubt.sessionId);
    await ctx.db.patch(doubt._id, { status: args.action, resolvedAt: Date.now() });
    return { doubtId: doubt._id, status: args.action };
  },
});

