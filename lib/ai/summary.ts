/**
 * Server-only summary provider selection.
 *
 * Kept separate from summary-adapter.ts so provider modules can import the
 * shared types without a circular import, and so feature code has exactly one
 * entry point. Adding OpenAI later is a case in this switch plus a sibling of
 * providers/gemini.ts — no caller changes.
 */

import {
  DisabledSummaryAdapter,
  MockSummaryAdapter,
  type SummaryAdapter,
} from "./summary-adapter";
import { GeminiSummaryAdapter } from "./providers/gemini";

/**
 * A missing key degrades to the disabled adapter rather than throwing, because
 * End Class must never depend on AI configuration being present.
 */
export function getSummaryAdapter(
  env: Record<string, string | undefined> = process.env,
): SummaryAdapter {
  const provider = env.AI_PROVIDER?.trim().toLowerCase() || "mock";

  if (provider === "mock") return new MockSummaryAdapter();

  if (provider === "gemini") {
    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) return new DisabledSummaryAdapter();
    return new GeminiSummaryAdapter(apiKey, env.GEMINI_MODEL?.trim() || undefined);
  }

  // "openai" lands here until a providers/openai.ts exists.
  return new DisabledSummaryAdapter();
}
