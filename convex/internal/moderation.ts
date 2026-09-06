/** Internal AI triage boundary. Disabled providers return uncertain. */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { getModerationAdapter, moderationResultSchema } from "../../lib/ai/moderation-adapter";

export const triageDoubt = internalAction({
  args: { text: v.string(), sessionId: v.string() },
  handler: async (_ctx, args) => {
    const started = Date.now();
    try {
      const result = await Promise.race([
        getModerationAdapter().moderate({ text: args.text, sessionId: args.sessionId }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
      ]);
      const parsed = moderationResultSchema.safeParse(result);
      if (!parsed.success) return { outcome: "uncertain" as const, reasonCode: "provider_invalid", latencyMs: Date.now() - started };
      return { ...parsed.data, latencyMs: Date.now() - started };
    } catch {
      return { outcome: "uncertain" as const, reasonCode: "provider_unavailable", latencyMs: Date.now() - started };
    }
  },
});
