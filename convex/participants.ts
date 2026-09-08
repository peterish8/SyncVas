/** Anonymous participant admission and coarse room presence metadata. */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { deterministicScreen } from "./moderation";
import { fail } from "./errors";

const CODE_PATTERN = /^[A-Z2-9]{6}$/;
const PROOF_MIN_LENGTH = 16;
const DISPLAY_NAME_MAX_CHARS = 24;

/**
 * QUIZ-01. Display names exist for leaderboards only — the doubts queue never
 * shows one, because doubt anonymity is what protects a shy student asking a
 * question. A rejected name re-prompts rather than being silently substituted.
 */
function screenDisplayName(displayName: string): string {
  const value = displayName.trim().replace(/\s+/gu, " ");
  if (!value) fail("DISPLAY_NAME_REQUIRED", "Enter a name for the leaderboard.");
  if (value.length > DISPLAY_NAME_MAX_CHARS) {
    fail("DISPLAY_NAME_TOO_LONG", "Keep the name under 24 characters.");
  }
  const screened = deterministicScreen(value);
  if (screened.outcome === "reject") {
    fail("DISPLAY_NAME_REJECTED", `Choose a different name (${screened.reasonCode ?? "not allowed"}).`);
  }
  return value;
}

async function pseudonymousHash(sessionId: string, proof: string): Promise<string> {
  const bytes = new TextEncoder().encode(`syncvas-participant-v1:${sessionId}:${proof}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const joinByCode = mutation({
  args: { code: v.string(), anonymousProof: v.string(), displayName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    // Screen before any lookup so a rejected name costs nothing else.
    const displayName = args.displayName === undefined ? undefined : screenDisplayName(args.displayName);
    if (!CODE_PATTERN.test(code)) fail("INVALID_JOIN_CODE", "Enter the six-character room code.");
    if (args.anonymousProof.length < PROOF_MIN_LENGTH || args.anonymousProof.length > 512) {
      fail("INVALID_ANONYMOUS_PROOF", "Refresh the page and try again.");
    }

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (!session) fail("SESSION_NOT_FOUND", "We could not find that room.");
    if (session.status !== "live") {
      if (session.status === "ended") fail("SESSION_ENDED", "This class has ended.");
      fail("SESSION_NOT_LIVE", "This class is not open yet.");
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
        fail("PARTICIPANT_BLOCKED", "Joining is temporarily unavailable.");
      }
      await ctx.db.patch(existing._id, {
        lastSeenAt: now,
        ...(displayName ? { displayName } : {}),
      });
      return { sessionId: session._id, participantId: existing._id, displayName: displayName ?? existing.displayName };
    }

    const participantId = await ctx.db.insert("participants", {
      sessionId: session._id,
      anonymousIdHash,
      displayName,
      joinedAt: now,
      lastSeenAt: now,
      doubtCount: 0,
    });
    // Same transaction as the insert, so the counter cannot drift from the rows.
    // Only this branch increments: the rejoin above patches lastSeenAt and must not
    // count the same student twice.
    await ctx.db.patch(session._id, { studentCount: (session.studentCount ?? 0) + 1 });
    return { sessionId: session._id, participantId, displayName };
  },
});

/**
 * Safe, room-scoped aggregate only; no participant IDs or names are returned.
 *
 * Reads the denormalized counter rather than collecting the room. This query is
 * reactive and every doubt submission patches a participant's lastSeenAt, so
 * collecting here re-read every participant of the room on each submission.
 */
export const countForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return { connectedCount: session?.studentCount ?? 0 };
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
