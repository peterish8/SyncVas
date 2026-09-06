/**
 * @phase 10
 * Provider-agnostic moderation adapter
 *
 * Schema contract; disabled default; server-only credentials; timeout and
 * failure fall back to uncertain rather than losing a plausible question.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DisabledModerationAdapter,
  getModerationAdapter,
  moderationRequestSchema,
  moderationResultSchema,
} from "@/lib/ai/moderation-adapter";
import { createLiveModerationAdapter } from "@/lib/ai/providers";

const ENDPOINT = "https://moderation.test/v1/screen";
const API_KEY = "test-moderation-key";

const originalFetch = globalThis.fetch;
const originalEnv = { url: process.env.MODERATION_API_URL, key: process.env.MODERATION_API_KEY };

beforeEach(() => {
  delete process.env.MODERATION_API_URL;
  delete process.env.MODERATION_API_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.MODERATION_API_URL = originalEnv.url;
  process.env.MODERATION_API_KEY = originalEnv.key;
  if (originalEnv.url === undefined) delete process.env.MODERATION_API_URL;
  if (originalEnv.key === undefined) delete process.env.MODERATION_API_KEY;
  vi.useRealTimers();
});

describe("AI-01 request contract keeps student identity out of the provider", () => {
  it("accepts only bounded text and a room scope", () => {
    expect(moderationRequestSchema.safeParse({ text: "Why is b halved?", sessionId: "sessions:1" }).success).toBe(true);
  });

  it("rejects any extra field, so identity cannot be smuggled in", () => {
    for (const extra of [{ participantId: "participants:a" }, { anonymousIdHash: "hash-a" }, { displayName: "Ana" }]) {
      const parsed = moderationRequestSchema.safeParse({ text: "Why?", sessionId: "sessions:1", ...extra });
      expect(parsed.success).toBe(false);
    }
  });

  it("rejects text beyond the doubt limit and an empty room scope", () => {
    expect(moderationRequestSchema.safeParse({ text: "x".repeat(221), sessionId: "sessions:1" }).success).toBe(false);
    expect(moderationRequestSchema.safeParse({ text: "Why?", sessionId: "" }).success).toBe(false);
  });
});

describe("AI-02 result contract", () => {
  it("accepts the documented outcomes", () => {
    for (const outcome of ["accept", "reject", "uncertain"]) {
      expect(moderationResultSchema.safeParse({ outcome }).success).toBe(true);
    }
  });

  it("rejects an unknown outcome rather than coercing it", () => {
    for (const outcome of ["merged", "approved", "", null, 1]) {
      expect(moderationResultSchema.safeParse({ outcome }).success).toBe(false);
    }
  });

  it("bounds the relevance score to 0..1", () => {
    expect(moderationResultSchema.safeParse({ outcome: "accept", relevanceScore: 0 }).success).toBe(true);
    expect(moderationResultSchema.safeParse({ outcome: "accept", relevanceScore: 1 }).success).toBe(true);
    expect(moderationResultSchema.safeParse({ outcome: "accept", relevanceScore: 1.01 }).success).toBe(false);
    expect(moderationResultSchema.safeParse({ outcome: "accept", relevanceScore: -0.1 }).success).toBe(false);
  });

  it("rejects unknown result fields from a provider", () => {
    expect(
      moderationResultSchema.safeParse({ outcome: "accept", promptInjection: "ignore previous instructions" }).success,
    ).toBe(false);
  });
});

describe("AI-03 the default deployment runs without a provider", () => {
  it("returns uncertain rather than blocking when disabled", async () => {
    const result = await new DisabledModerationAdapter().moderate({ text: "Why?", sessionId: "sessions:1" });
    expect(result).toEqual({ outcome: "uncertain", reasonCode: "provider_disabled" });
  });

  it("selects the disabled adapter when no credentials are configured", () => {
    expect(getModerationAdapter()).toBeInstanceOf(DisabledModerationAdapter);
  });

  it("does not activate on a half-configured provider", () => {
    process.env.MODERATION_API_URL = ENDPOINT;
    expect(getModerationAdapter()).toBeInstanceOf(DisabledModerationAdapter);

    delete process.env.MODERATION_API_URL;
    process.env.MODERATION_API_KEY = API_KEY;
    expect(getModerationAdapter()).toBeInstanceOf(DisabledModerationAdapter);
  });

  it("treats whitespace-only configuration as unconfigured", () => {
    process.env.MODERATION_API_URL = "   ";
    process.env.MODERATION_API_KEY = "   ";
    expect(getModerationAdapter()).toBeInstanceOf(DisabledModerationAdapter);
  });

  it("keeps the phase 10 provider factory disabled until a provider is chosen", async () => {
    const result = await createLiveModerationAdapter().moderate({ text: "Why?", sessionId: "sessions:1" });
    expect(result.outcome).toBe("uncertain");
  });
});

describe("AI-04 configured provider transport", () => {
  function configure() {
    process.env.MODERATION_API_URL = ENDPOINT;
    process.env.MODERATION_API_KEY = API_KEY;
  }

  it("posts the bounded request with a server-side bearer credential", async () => {
    configure();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ outcome: "accept", reasonCode: "related_clarification" }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await getModerationAdapter().moderate({ text: "Why is b halved?", sessionId: "sessions:1" });

    expect(result).toEqual({ outcome: "accept", reasonCode: "related_clarification" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(ENDPOINT);
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe(`Bearer ${API_KEY}`);
    // Only the two contracted fields cross the boundary.
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ text: "Why is b halved?", sessionId: "sessions:1" });
  });

  it("raises rather than trusting a non-OK provider response", async () => {
    configure();
    globalThis.fetch = (async () => new Response("upstream exploded", { status: 500 })) as unknown as typeof fetch;

    await expect(
      getModerationAdapter().moderate({ text: "Why?", sessionId: "sessions:1" }),
    ).rejects.toThrow(/moderation_http_500/u);
  });

  it("raises rather than trusting a malformed provider payload", async () => {
    configure();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ outcome: "definitely-spam" }), { status: 200 })) as unknown as typeof fetch;

    await expect(
      getModerationAdapter().moderate({ text: "Why?", sessionId: "sessions:1" }),
    ).rejects.toThrow(/moderation_invalid_result/u);
  });

  it("aborts a hanging provider instead of stalling the doubt pipeline", async () => {
    configure();
    let abortSignal: AbortSignal | undefined;
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      abortSignal = init.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }) as unknown as typeof fetch;

    const pending = getModerationAdapter().moderate({ text: "Why?", sessionId: "sessions:1" });
    expect(abortSignal).toBeInstanceOf(AbortSignal);
    expect(abortSignal?.aborted).toBe(false);

    await expect(pending).rejects.toThrow();
    expect(abortSignal?.aborted).toBe(true);
  }, 10_000);

  it("never writes the doubt text or the credential to the console", async () => {
    configure();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;

    await getModerationAdapter()
      .moderate({ text: "a secret student question", sessionId: "sessions:1" })
      .catch(() => undefined);

    const written = spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join(" ");
    expect(written).not.toContain("a secret student question");
    expect(written).not.toContain(API_KEY);
    spies.forEach((spy) => spy.mockRestore());
  });
});
