/** Authenticated Convex -> Socket.IO room revocation callback. */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

function base64Url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(body: string, timestamp: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return base64Url(new Uint8Array(digest));
}

export const run = internalAction({
  args: { sessionId: v.id("sessions") },
  handler: async (_ctx, args) => {
    const endpoint = process.env.SOCKET_SERVICE_INTERNAL_URL?.trim();
    const secret = process.env.SOCKET_INTERNAL_SECRET?.trim();
    if (!endpoint || !secret || secret.length < 32) {
      return { ok: false as const, reason: "SOCKET_REVOCATION_NOT_CONFIGURED" as const };
    }

    const body = JSON.stringify({ sessionId: args.sessionId });
    const timestamp = String(Math.floor(Date.now() / 1000));
    try {
      const response = await fetch(new URL("/internal/revoke-room", endpoint), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-syncvas-timestamp": timestamp,
          "x-syncvas-signature": await sign(body, timestamp, secret),
        },
        body,
      });
      return response.ok
        ? { ok: true as const }
        : { ok: false as const, reason: "SOCKET_REVOCATION_REJECTED" as const };
    } catch {
      // Session state is already ending/ended in Convex. A later retry can
      // safely call the idempotent endpoint when the relay returns.
      return { ok: false as const, reason: "SOCKET_REVOCATION_UNAVAILABLE" as const };
    }
  },
});
