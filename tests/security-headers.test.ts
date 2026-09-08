import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

async function rules(): Promise<HeaderRule[]> {
  if (typeof nextConfig.headers !== "function") throw new Error("next.config must define headers()");
  return (await nextConfig.headers()) as HeaderRule[];
}

function globalHeaders(all: HeaderRule[]): Map<string, string> {
  const rule = all.find((entry) => entry.source === "/:path*");
  if (!rule) throw new Error("Expected a catch-all header rule");
  return new Map(rule.headers.map((header) => [header.key, header.value]));
}

describe("security headers", () => {
  it("sets the headers a browser cannot infer on its own", async () => {
    const headers = globalHeaders(await rules());

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("does not advertise the framework", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("ships a content security policy that denies framing and plugins", async () => {
    const headers = globalHeaders(await rules());
    const csp =
      headers.get("Content-Security-Policy") ?? headers.get("Content-Security-Policy-Report-Only") ?? "";

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // Excalidraw renders generated and pasted images from blob:/data: URLs.
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("keeps the policy report-only until CSP_ENFORCE is set", async () => {
    // The policy has not been exercised against an enforcing browser on every
    // classroom path, so the default must not be able to break a live lesson.
    const headers = globalHeaders(await rules());
    const enforcing = process.env.CSP_ENFORCE === "1";
    expect(headers.has(enforcing ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only")).toBe(true);
  });

  it("marks classroom and auth routes as uncacheable", async () => {
    const rule = (await rules()).find((entry) => entry.source.includes("teacher"));
    expect(rule?.headers[0]?.value).toContain("no-store");
  });
});
