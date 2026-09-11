import type { NextConfig } from "next";

import { assertProductionEnv } from "./lib/production-env";

// Runs during `next build` and `next start`. On a real deploy (VERCEL_ENV=production
// or SYNCVAS_ENFORCE_ENV=1) a misconfigured environment fails here instead of
// shipping a site that quietly advertises localhost and cannot join a classroom.
assertProductionEnv();

/**
 * Security headers.
 *
 * The app had no next.config at all before launch hardening, which meant none of
 * these were set. Each entry below is one the browser cannot infer on its own.
 */

/**
 * Origins the browser genuinely opens connections to at runtime:
 * Convex over HTTPS + WSS, and the Socket.IO relay over HTTP(S) + WS(S).
 * Both are public env values, so reading them here is safe.
 */
function connectSources(): string[] {
  const sources = new Set<string>(["'self'"]);

  for (const raw of [process.env.NEXT_PUBLIC_CONVEX_URL, process.env.NEXT_PUBLIC_SOCKET_URL]) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      sources.add(url.origin);
      // Convex subscriptions and Socket.IO both upgrade to a websocket on the
      // same origin, and CSP treats ws:// as a distinct scheme from http://.
      sources.add(url.origin.replace(/^http/, "ws"));
    } catch {
      // A malformed public URL is a deploy-config problem, not a reason to emit
      // a broken header; leaving it out fails closed.
    }
  }

  return [...sources];
}

/** The policy ships report-only until a full classroom run confirms it is clean. */
function cspEnforced(): boolean {
  return process.env.CSP_ENFORCE === "1";
}

function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    // Next's inlined bootstrap and Excalidraw's runtime both need these; Next
    // does not emit per-request nonces for statically prerendered routes.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    // next/font self-hosts, so no external font origin is required.
    "font-src 'self' data:",
    // Excalidraw renders pasted and generated images as blob:/data: URLs.
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src ${connectSources().join(" ")}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Browsers ignore this one in a report-only policy and log an error for it
    // on every page load, so it is only emitted once the policy is enforced.
    ...(cspEnforced() ? (["upgrade-insecure-requests"] as const) : []),
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // The classroom needs none of these; denying them shrinks the surface a
    // compromised dependency could reach.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    /**
     * Report-Only by default.
     *
     * The policy above is believed correct, but Excalidraw's worker and font
     * loading has not been exercised against an enforcing policy in every
     * classroom path. Ship report-only, watch for violations, then set
     * CSP_ENFORCE=1 to switch the same policy to enforcing without editing code.
     */
    key: cspEnforced() ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy(),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Never let an intermediary cache a classroom or auth response.
        //
        // A trailing `.*` is not valid path-to-regexp and makes Next reject the
        // whole config ("Invalid header found"). `/:rest*` is the supported
        // form: it matches the bare route and anything nested under it.
        source: "/:path(teacher|join|student)/:rest*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
