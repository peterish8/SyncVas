/** Authenticated Convex -> Socket.IO room revocation callback. */

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { FunctionReference } from "convex/server";

/**
 * Files under `convex/internal/` land in the generated API under a
 * slash-containing key, so self-scheduling needs the same cast the other
 * callers of this module use. See the convention note in CLAUDE.md.
 */
const revokeRoomSelf = (internal as unknown as {
  "internal/revokeRoom": {
    run: FunctionReference<"action", "internal", { sessionId: Id<"sessions">; attempt?: number }, unknown>;
  };
})["internal/revokeRoom"].run;

/**
 * Revocation is the only thing that evicts live sockets when a class ends.
 *
 * Until it lands, every already-connected socket keeps relaying the board on a
 * token that stays valid for the remainder of its five-minute TTL — so a relay
 * that is merely restarting during End Class used to mean the classroom carried
 * on broadcasting after the teacher had closed it. Retrying across roughly the
 * token lifetime closes that window; the endpoint is idempotent, so a retry that
 * races a successful first call is harmless.
 */
const REVOKE_MAX_ATTEMPTS = 6;
const REVOKE_RETRY_MS = 10_000;

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
  args: { sessionId: v.id("sessions"), attempt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 0;
    const endpoint = process.env.SOCKET_SERVICE_INTERNAL_URL?.trim();
    const secret = process.env.SOCKET_INTERNAL_SECRET?.trim();
    if (!endpoint || !secret || secret.length < 32) {
      // Misconfiguration, not a transient fault: retrying cannot fix an absent
      // endpoint or secret, so record it once and stop.
      await ctx.runMutation(internal.sessions.recordRevocationOutcome, {
        sessionId: args.sessionId,
        warning: "SOCKET_REVOCATION_NOT_CONFIGURED",
      });
      return { ok: false as const, reason: "SOCKET_REVOCATION_NOT_CONFIGURED" as const };
    }

    const body = JSON.stringify({ sessionId: args.sessionId });
    const timestamp = String(Math.floor(Date.now() / 1000));

    let reason: "SOCKET_REVOCATION_REJECTED" | "SOCKET_REVOCATION_UNAVAILABLE";
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
      if (response.ok) {
        // Clear any warning left by an earlier attempt so the session does not
        // keep reporting a failure that has since resolved.
        await ctx.runMutation(internal.sessions.recordRevocationOutcome, {
          sessionId: args.sessionId,
          warning: null,
        });
        return { ok: true as const, attempt };
      }
      reason = "SOCKET_REVOCATION_REJECTED" as const;
    } catch {
      reason = "SOCKET_REVOCATION_UNAVAILABLE" as const;
    }

    if (attempt + 1 < REVOKE_MAX_ATTEMPTS) {
      await ctx.scheduler.runAfter(REVOKE_RETRY_MS, revokeRoomSelf, {
        sessionId: args.sessionId,
        attempt: attempt + 1,
      });
      return { ok: false as const, reason, attempt, retrying: true as const };
    }

    // Out of attempts. The room is already ending/ended in Convex, so the
    // classroom is closed to new joins either way — but sockets admitted before
    // the end may have kept streaming, and that must be visible rather than
    // swallowed the way it was before.
    await ctx.runMutation(internal.sessions.recordRevocationOutcome, {
      sessionId: args.sessionId,
      warning: reason,
    });
    return { ok: false as const, reason, attempt, retrying: false as const };
  },
});
