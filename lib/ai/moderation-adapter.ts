/**
 * @scaffold true
 * @phase 7+10
 * Provider-agnostic moderation adapter
 *
 * Phase 7: define ModerationRequest/Result Zod schemas; DisabledModerationAdapter → uncertain.
 * Phase 10: one provider impl under lib/ai/providers; NEVER import SDK in feature/UI code.
 * Credentials server-only. No student identity. No board dump. No doubt text in logs.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { z } from "zod";

export const moderationRequestSchema = z
  .object({
    // PHASE 7: minimal fields — normalized text hash or bounded text, session scope
    text: z.string().max(220),
    sessionId: z.string().min(1),
  })
  .strict();

export const moderationResultSchema = z
  .object({
    outcome: z.enum(["accept", "reject", "uncertain"]),
    reasonCode: z.string().optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
  })
  .strict();

export type ModerationRequest = z.infer<typeof moderationRequestSchema>;
export type ModerationResult = z.infer<typeof moderationResultSchema>;

export interface ModerationAdapter {
  moderate(req: ModerationRequest): Promise<ModerationResult>;
}

/** Default until Phase 10 configures a provider. */
export class DisabledModerationAdapter implements ModerationAdapter {
  async moderate(_req: ModerationRequest): Promise<ModerationResult> {
    return { outcome: "uncertain", reasonCode: "provider_disabled" };
  }
}

class HttpModerationAdapter implements ModerationAdapter {
  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_500);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`moderation_http_${response.status}`);
      const parsed = moderationResultSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("moderation_invalid_result");
      return parsed.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getModerationAdapter(): ModerationAdapter {
  // A generic server-only HTTP contract keeps provider SDKs out of feature code.
  const endpoint = process.env.MODERATION_API_URL?.trim();
  const apiKey = process.env.MODERATION_API_KEY?.trim();
  if (endpoint && apiKey) return new HttpModerationAdapter(endpoint, apiKey);
  return new DisabledModerationAdapter();
}
