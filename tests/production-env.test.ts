import { describe, expect, it } from "vitest";

import {
  assertProductionEnv,
  inspectProductionEnv,
  shouldEnforceProductionEnv,
} from "@/lib/production-env";

/** A minimal, correct production environment. */
const GOOD = {
  NEXT_PUBLIC_CONVEX_URL: "https://famous-okapi-989.convex.cloud",
  NEXT_PUBLIC_SOCKET_URL: "https://relay.syncvas.app",
  NEXT_PUBLIC_APP_URL: "https://syncvas.app",
  SOCKET_INTERNAL_SECRET: "s".repeat(48),
  ALLOWED_WEB_ORIGINS: "https://syncvas.app",
  SOCKET_SERVICE_INTERNAL_URL: "https://relay.syncvas.app",
} as unknown as NodeJS.ProcessEnv;

/** Build a ProcessEnv from a partial without fighting the NODE_ENV requirement. */
function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as unknown as NodeJS.ProcessEnv;
}

function errorKeys(env: NodeJS.ProcessEnv): string[] {
  return inspectProductionEnv(env)
    .filter((problem) => problem.severity === "error")
    .map((problem) => problem.key);
}

describe("production env preflight", () => {
  it("passes a correct production environment with no blocking problems", () => {
    expect(errorKeys(GOOD)).toEqual([]);
  });

  it("blocks a missing canonical app URL", () => {
    // Without it, robots.txt, sitemap.xml, canonicals, and OG images all
    // advertise localhost while the site otherwise looks healthy.
    const env = { ...GOOD };
    delete env.NEXT_PUBLIC_APP_URL;
    expect(errorKeys(env)).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("blocks a localhost value that was copied from a developer machine", () => {
    expect(errorKeys({ ...GOOD, NEXT_PUBLIC_SOCKET_URL: "http://localhost:4001" })).toContain("NEXT_PUBLIC_SOCKET_URL");
  });

  it("blocks a non-https socket URL", () => {
    // A page served over HTTPS cannot open a ws:// connection.
    expect(errorKeys({ ...GOOD, NEXT_PUBLIC_SOCKET_URL: "http://relay.syncvas.app" })).toContain("NEXT_PUBLIC_SOCKET_URL");
  });

  it("blocks a short or placeholder relay secret", () => {
    expect(errorKeys({ ...GOOD, SOCKET_INTERNAL_SECRET: "tooshort" })).toContain("SOCKET_INTERNAL_SECRET");
    expect(errorKeys({ ...GOOD, SOCKET_INTERNAL_SECRET: "replace-with-long-random-secret-000000" })).toContain(
      "SOCKET_INTERNAL_SECRET",
    );
  });

  it("blocks every development escape hatch", () => {
    expect(errorKeys({ ...GOOD, ALLOW_DEV_TEACHER: "1" })).toContain("ALLOW_DEV_TEACHER");
    expect(errorKeys({ ...GOOD, ALLOW_PROOF_SOCKET: "1" })).toContain("ALLOW_PROOF_SOCKET");
    expect(errorKeys({ ...GOOD, NEXT_PUBLIC_ENABLE_LOCAL_TEACHER: "1" })).toContain("NEXT_PUBLIC_ENABLE_LOCAL_TEACHER");
  });

  it("blocks a relay origin list that omits the site's own origin", () => {
    // The relay would refuse every browser arriving from the deployed site.
    expect(errorKeys({ ...GOOD, ALLOWED_WEB_ORIGINS: "https://other.example.net" })).toContain("ALLOWED_WEB_ORIGINS");
  });

  it("blocks wildcard relay origins", () => {
    expect(errorKeys({ ...GOOD, ALLOWED_WEB_ORIGINS: "*" })).toContain("ALLOWED_WEB_ORIGINS");
  });

  it("treats a missing AI key as a warning, never a launch blocker", () => {
    const problems = inspectProductionEnv({ ...GOOD, AI_PROVIDER: "gemini" });
    const aiProblem = problems.find((problem) => problem.key === "GOOGLE_GENERATIVE_AI_API_KEY");
    expect(aiProblem?.severity).toBe("warning");
    expect(errorKeys({ ...GOOD, AI_PROVIDER: "gemini" })).toEqual([]);
  });

  it("warns but does not block when session-end socket revocation is unconfigured", () => {
    const env = { ...GOOD };
    delete env.SOCKET_SERVICE_INTERNAL_URL;
    const problem = inspectProductionEnv(env).find((entry) => entry.key === "SOCKET_SERVICE_INTERNAL_URL");
    expect(problem?.severity).toBe("warning");
  });
});

describe("preflight enforcement gate", () => {
  it("stays off for a local production build so npm run verify still works", () => {
    expect(shouldEnforceProductionEnv(env({ NODE_ENV: "production" }))).toBe(false);
    expect(() => assertProductionEnv(env({ NODE_ENV: "production" }))).not.toThrow();
  });

  it("turns on for a real deploy", () => {
    expect(shouldEnforceProductionEnv(env({ VERCEL_ENV: "production" }))).toBe(true);
    expect(shouldEnforceProductionEnv(env({ SYNCVAS_ENFORCE_ENV: "1" }))).toBe(true);
  });

  it("throws with an actionable report when a real deploy is misconfigured", () => {
    expect(() => assertProductionEnv(env({ SYNCVAS_ENFORCE_ENV: "1" }))).toThrow(
      /NEXT_PUBLIC_CONVEX_URL/,
    );
  });

  it("does not throw when a real deploy is correctly configured", () => {
    expect(() => assertProductionEnv({ ...GOOD, SYNCVAS_ENFORCE_ENV: "1" })).not.toThrow();
  });
});
