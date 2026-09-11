/**
 * Deploy-time environment preflight.
 *
 * Every problem below fails silently at runtime rather than loudly at deploy
 * time, which is the worst shape for a launch: the site comes up, looks fine,
 * and is wrong in a way nobody notices until a class is already running.
 *
 * `next.config.ts` calls this during `next build` and `next start`.
 */

export type EnvProblem = {
  key: string;
  severity: "error" | "warning";
  detail: string;
};

const PLACEHOLDER_PATTERN = /localhost|127\.0\.0\.1|replace-with|changeme|example\.com/i;

function isHttpUrl(value: string, requireHttps: boolean): boolean {
  try {
    const url = new URL(value);
    if (requireHttps) return url.protocol === "https:";
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Inspect an environment as if it were a production deploy.
 *
 * Pure and env-injectable so it can be tested without mutating process.env.
 */
export function inspectProductionEnv(env: NodeJS.ProcessEnv): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const get = (key: string) => env[key]?.trim() ?? "";

  // ── Required, and wrong values are silent ────────────────────────────────
  const convexUrl = get("NEXT_PUBLIC_CONVEX_URL");
  if (!convexUrl) {
    problems.push({ key: "NEXT_PUBLIC_CONVEX_URL", severity: "error", detail: "Missing. The app cannot reach its database." });
  } else if (!isHttpUrl(convexUrl, true)) {
    problems.push({ key: "NEXT_PUBLIC_CONVEX_URL", severity: "error", detail: "Must be an https:// URL." });
  }

  const socketUrl = get("NEXT_PUBLIC_SOCKET_URL");
  if (!socketUrl) {
    problems.push({ key: "NEXT_PUBLIC_SOCKET_URL", severity: "error", detail: "Missing. Live board sync will never connect." });
  } else if (!isHttpUrl(socketUrl, true)) {
    problems.push({
      key: "NEXT_PUBLIC_SOCKET_URL",
      severity: "error",
      detail: "Must be an https:// URL; a browser on HTTPS refuses a ws:// upgrade from an http:// origin.",
    });
  }

  const appUrl = get("NEXT_PUBLIC_APP_URL");
  if (!appUrl) {
    problems.push({
      key: "NEXT_PUBLIC_APP_URL",
      severity: "error",
      detail: "Missing. Canonical URLs, robots.txt, sitemap.xml, and OpenGraph images would all advertise localhost.",
    });
  } else if (!isHttpUrl(appUrl, true)) {
    problems.push({ key: "NEXT_PUBLIC_APP_URL", severity: "error", detail: "Must be the canonical https:// origin." });
  }

  const secret = get("SOCKET_INTERNAL_SECRET");
  if (!secret) {
    problems.push({
      key: "SOCKET_INTERNAL_SECRET",
      severity: "error",
      detail: "Missing. Room tokens cannot be minted, so nobody can join a classroom.",
    });
  } else if (secret.length < 32) {
    problems.push({ key: "SOCKET_INTERNAL_SECRET", severity: "error", detail: "Must be at least 32 characters." });
  } else if (PLACEHOLDER_PATTERN.test(secret)) {
    problems.push({ key: "SOCKET_INTERNAL_SECRET", severity: "error", detail: "Still holds the placeholder value from .env.example." });
  }

  // ── Development-only escape hatches ──────────────────────────────────────
  // Each of these is additionally gated on NODE_ENV in code, so a stray value
  // is not itself an exploit; it is still a signal that production env was
  // copied from a developer machine.
  for (const key of ["ALLOW_DEV_TEACHER", "ALLOW_PROOF_SOCKET", "NEXT_PUBLIC_ENABLE_LOCAL_TEACHER"]) {
    if (get(key)) {
      problems.push({
        key,
        severity: "error",
        detail: "Development-only flag is set. Remove it from the production environment.",
      });
    }
  }

  // ── Values that must not be pointing at a developer machine ──────────────
  for (const key of ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_SOCKET_URL", "NEXT_PUBLIC_APP_URL", "ALLOWED_WEB_ORIGINS"]) {
    const value = get(key);
    if (value && PLACEHOLDER_PATTERN.test(value)) {
      problems.push({ key, severity: "error", detail: `Points at a local or placeholder host: "${value}".` });
    }
  }

  const origins = get("ALLOWED_WEB_ORIGINS");
  if (!origins) {
    problems.push({
      key: "ALLOWED_WEB_ORIGINS",
      severity: "warning",
      detail: "Unset. The relay falls back to localhost and will reject the deployed site by CORS.",
    });
  } else if (origins.includes("*")) {
    problems.push({ key: "ALLOWED_WEB_ORIGINS", severity: "error", detail: "Wildcard origins are not allowed in production." });
  } else if (appUrl && isHttpUrl(appUrl, true)) {
    const appOrigin = new URL(appUrl).origin;
    const list = origins.split(",").map((value) => value.trim());
    if (!list.includes(appOrigin)) {
      problems.push({
        key: "ALLOWED_WEB_ORIGINS",
        severity: "error",
        detail: `Does not include ${appOrigin}, so the relay would reject the site's own browsers.`,
      });
    }
  }

  // ── Optional integrations: warn only, never block a launch ───────────────
  const aiProvider = get("AI_PROVIDER");
  if (aiProvider === "gemini" && !get("GOOGLE_GENERATIVE_AI_API_KEY")) {
    problems.push({
      key: "GOOGLE_GENERATIVE_AI_API_KEY",
      severity: "warning",
      detail: 'AI_PROVIDER is "gemini" but no key is set; post-class summaries will stay unavailable.',
    });
  }
  if (!get("SOCKET_SERVICE_INTERNAL_URL")) {
    problems.push({
      key: "SOCKET_SERVICE_INTERNAL_URL",
      severity: "warning",
      detail: "Unset. Ending a class will not evict live sockets until their tokens expire.",
    });
  }

  return problems;
}

export function formatEnvProblems(problems: EnvProblem[]): string {
  const errors = problems.filter((problem) => problem.severity === "error");
  const warnings = problems.filter((problem) => problem.severity === "warning");
  const lines: string[] = [];

  if (errors.length > 0) {
    lines.push(`Production environment has ${errors.length} blocking problem(s):`);
    for (const problem of errors) lines.push(`  ✗ ${problem.key}: ${problem.detail}`);
  }
  if (warnings.length > 0) {
    lines.push(`Warnings (${warnings.length}):`);
    for (const problem of warnings) lines.push(`  ! ${problem.key}: ${problem.detail}`);
  }
  return lines.join("\n");
}

/**
 * Enforce only on a real deploy.
 *
 * `next build` runs with NODE_ENV=production on every developer machine too, so
 * keying off that alone would break local `npm run verify`. A real deploy sets
 * VERCEL_ENV=production, and SYNCVAS_ENFORCE_ENV=1 covers any other host.
 */
export function shouldEnforceProductionEnv(env: NodeJS.ProcessEnv): boolean {
  return env.SYNCVAS_ENFORCE_ENV === "1" || env.VERCEL_ENV === "production";
}

/** Throws on a real production deploy with blocking problems; warns otherwise. */
export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (!shouldEnforceProductionEnv(env)) return;
  const problems = inspectProductionEnv(env);
  const report = formatEnvProblems(problems);
  if (problems.some((problem) => problem.severity === "error")) {
    throw new Error(`\n${report}\n`);
  }
  if (report) console.warn(report);
}
