/** Deterministic moderation policy shared by the doubt pipeline and tests. */

import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Reason codes that mean the provider never rendered a judgement. A doubt the
 * deterministic pass already accepted must not be downgraded on these — docs/14
 * requires falling back rather than losing a plausible question.
 */
const PROVIDER_FALLBACK_REASONS = new Set([
  "provider_disabled",
  "provider_unavailable",
  "provider_invalid",
]);

export function deterministicScreen(text: string): { outcome: "accept" | "reject"; reasonCode?: string } {
  const value = text.trim();
  if (!value) return { outcome: "reject", reasonCode: "empty" };
  if (/^(.)\1{5,}$/u.test(value)) return { outcome: "reject", reasonCode: "noise" };
  if (/^(?:[\p{Extended_Pictographic}\s])+$/u.test(value)) return { outcome: "reject", reasonCode: "noise" };
  if (/https?:\/\//iu.test(value)) return { outcome: "reject", reasonCode: "blocked_url" };
  if (/\b(?:fuck|shit|bitch)\b/iu.test(value)) return { outcome: "reject", reasonCode: "profanity" };
  return { outcome: "accept" };
}

/**
 * Applies an AI triage outcome to a doubt the deterministic pass accepted.
 * Never deletes: every call records a moderationEvent, and an unavailable
 * provider leaves the doubt visible in the teacher queue.
 */
export const applyTriage = internalMutation({
  args: {
    doubtId: v.id("doubts"),
    outcome: v.union(v.literal("accept"), v.literal("reject"), v.literal("uncertain")),
    reasonCode: v.optional(v.string()),
    relevanceScore: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const doubt = await ctx.db.get(args.doubtId);
    if (!doubt) return null;
    // The teacher may have answered or dismissed it while triage was in flight.
    if (doubt.status !== "accepted") return null;

    const reasonCode = args.reasonCode ?? "unspecified";
    const providerAnswered = !PROVIDER_FALLBACK_REASONS.has(reasonCode);
    const nextStatus = !providerAnswered
      ? doubt.status
      : args.outcome === "reject"
        ? ("rejected" as const)
        : args.outcome === "uncertain"
          ? ("uncertain" as const)
          : ("accepted" as const);

    if (nextStatus !== doubt.status) {
      await ctx.db.patch(doubt._id, { status: nextStatus, reasonCode, relevanceScore: args.relevanceScore });
    } else if (args.relevanceScore !== undefined) {
      await ctx.db.patch(doubt._id, { relevanceScore: args.relevanceScore });
    }

    await ctx.db.insert("moderationEvents", {
      sessionId: doubt.sessionId,
      doubtId: doubt._id,
      participantId: doubt.participantId,
      decision: nextStatus,
      reasonCode,
      latencyMs: args.latencyMs,
      createdAt: Date.now(),
    });
    return { doubtId: doubt._id, status: nextStatus };
  },
});

export const _scaffoldPing = query({
  args: { text: v.optional(v.string()) },
  handler: async (_ctx, args) => ({ phase: 7, module: "moderation", ready: true, result: args.text ? deterministicScreen(args.text) : null }),
});
