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
    if (!CODE_PATTERN.test(code)) throw new Error("INVALID_JOIN_CODE");
    if (args.anonymousProof.length < PROOF_MIN_LENGTH || args.anonymousProof.length > 512) {
      throw new Error("INVALID_ANONYMOUS_PROOF");
    }
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.status !== "live") throw new Error(session.status === "ended" ? "SESSION_ENDED" : "SESSION_NOT_LIVE");

    const anonymousIdHash = await pseudonymousHash(session._id, args.anonymousProof);
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_session_anonymous", (q) => q.eq("sessionId", session._id).eq("anonymousIdHash", anonymousIdHash))
      .unique();
    const now = Date.now();
    if (existing) {
      if (existing.blockedUntil !== undefined && existing.blockedUntil > now) throw new Error("PARTICIPANT_BLOCKED");
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

export const getParticipantForSession = query({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return null;
    return { sessionId: participant.sessionId, participantId: participant._id };
  },
});
