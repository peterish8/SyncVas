/** Internal AI triage boundary. Disabled providers return uncertain. */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getModerationAdapter, moderationResultSchema } from "../../lib/ai/moderation-adapter";

const TRIAGE_TIMEOUT_MS = 2_500;

export const triageDoubt = internalAction({
  args: { doubtId: v.id("doubts"), text: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const started = Date.now();
    let outcome: "accept" | "reject" | "uncertain" = "uncertain";
    let reasonCode = "provider_unavailable";
    let relevanceScore: number | undefined;

    try {
      const result = await Promise.race([
        getModerationAdapter().moderate({ text: args.text, sessionId: args.sessionId }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), TRIAGE_TIMEOUT_MS),
        ),
      ]);
      const parsed = moderationResultSchema.safeParse(result);
      if (parsed.success) {
        outcome = parsed.data.outcome;
        reasonCode = parsed.data.reasonCode ?? "unspecified";
        relevanceScore = parsed.data.relevanceScore;
      } else {
        reasonCode = "provider_invalid";
      }
    } catch {
      // Never surface provider detail or the doubt text itself.
      reasonCode = "provider_unavailable";
    }

    const latencyMs = Date.now() - started;
    await ctx.runMutation(internal.moderation.applyTriage, {
      doubtId: args.doubtId,
      outcome,
      reasonCode,
      relevanceScore,
      latencyMs,
    });
    return { outcome, reasonCode, latencyMs };
  },
});
