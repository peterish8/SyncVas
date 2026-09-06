/** Deterministic moderation policy shared by the doubt pipeline and tests. */

import { query } from "./_generated/server";
import { v } from "convex/values";

export function deterministicScreen(text: string): { outcome: "accept" | "reject"; reasonCode?: string } {
  const value = text.trim();
  if (!value) return { outcome: "reject", reasonCode: "empty" };
  if (/^(.)\1{5,}$/u.test(value)) return { outcome: "reject", reasonCode: "noise" };
  if (/^(?:[\p{Extended_Pictographic}\s])+$/u.test(value)) return { outcome: "reject", reasonCode: "noise" };
  if (/https?:\/\//iu.test(value)) return { outcome: "reject", reasonCode: "blocked_url" };
  if (/\b(?:fuck|shit|bitch)\b/iu.test(value)) return { outcome: "reject", reasonCode: "profanity" };
  return { outcome: "accept" };
}

export const _scaffoldPing = query({
  args: { text: v.optional(v.string()) },
  handler: async (_ctx, args) => ({ phase: 7, module: "moderation", ready: true, result: args.text ? deterministicScreen(args.text) : null }),
});
