/** Anonymous participant admission and coarse room presence metadata. */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const CODE_PATTERN = /^[A-Z2-9]{6}$/;
const PROOF_MIN_LENGTH = 16;

async function pseudonymousHash(sessionId: string, proof: string): Promise<string> {
  const bytes = new TextEncoder().encode(`syncvas-participant-v1:${sessionId}:${proof}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const joinByCode = mutation({
  args: { code: v.string(), anonymousProof: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) throw new Error("INVALID_JOIN_CODE: Enter the six-character room code.");
    if (args.anonymousProof.length < PROOF_MIN_LENGTH || args.anonymousProof.length > 512) {
      throw new Error("INVALID_ANONYMOUS_PROOF: Refresh the page and try again.");
    }

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (!session) throw new Error("SESSION_NOT_FOUND: We could not find that room.");
    if (session.status !== "live") {
      throw new Error(session.status === "ended" ? "SESSION_ENDED: This class has ended." : "SESSION_NOT_LIVE: This class is not open yet.");
    }

    const anonymousIdHash = await pseudonymousHash(session._id, args.anonymousProof);
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_session_anonymous", (q) =>
        q.eq("sessionId", session._id).eq("anonymousIdHash", anonymousIdHash),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      if (existing.blockedUntil !== undefined && existing.blockedUntil > now) {
        throw new Error("PARTICIPANT_BLOCKED: Joining is temporarily unavailable.");
      }
      await ctx.db.patch(existing._id, { lastSeenAt: now });
      return { sessionId: session._id, participantId: existing._id };
    }

    const participantId = await ctx.db.insert("participants", {
      sessionId: session._id,
      anonymousIdHash,
      joinedAt: now,
      lastSeenAt: now,
      doubtCount: 0,
    });
    return { sessionId: session._id, participantId };
  },
});

/** Safe, room-scoped aggregate only; no participant IDs or names are returned. */
export const countForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return { connectedCount: participants.length };
  },
});

export const getParticipantForSession = query({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return null;
    return { sessionId: participant.sessionId, participantId: participant._id };
  },
});
