/** Durable classroom session lifecycle and server-issued socket admission. */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isLocalDevTeacherAllowed, requireSessionOwner, requireTeacher } from "./permissions";
import { LOCAL_DEV_TEACHER_SUBJECT } from "./authBootstrap";
import { fail } from "./errors";
import { saveFinalSnapshot } from "./boardSnapshots";
import { ROOM_TOKEN_TTL_SECONDS } from "../shared/constants/limits";

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_PATTERN = /^[A-Z2-9]{6}$/;
const JOIN_CODE_LENGTH = 6;
const SOCKET_TOKEN_TTL_SECONDS = ROOM_TOKEN_TTL_SECONDS;
const revokeRoom = (internal as unknown as {
  "internal/revokeRoom": { run: FunctionReference<"action", "internal", { sessionId: Id<"sessions"> }, unknown> };
})["internal/revokeRoom"].run;
const summarizeSession = (internal as unknown as {
  "internal/summarize": { run: FunctionReference<"action", "internal", { sessionId: Id<"sessions"> }, unknown> };
})["internal/summarize"].run;

// `fail` now lives in ./errors and throws a ConvexError. A plain Error here
// meant every code below arrived at the browser as "Server Error" on a
// production deployment while looking correct in dev.

function normalizeTitle(title: string | undefined): string {
  const normalized = title?.trim() ?? "";
  if (normalized.length > 120) fail("TITLE_TOO_LONG", "Class title must be 120 characters or fewer.");
  return normalized || "Untitled class";
}

function normalizeSubject(subject: string | undefined): string | undefined {
  const normalized = subject?.trim();
  if (!normalized) return undefined;
  if (normalized.length > 80) fail("SUBJECT_TOO_LONG", "Subject must be 80 characters or fewer.");
  return normalized;
}

function randomJoinCode(): string {
  const bytes = new Uint32Array(JOIN_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => JOIN_ALPHABET[value % JOIN_ALPHABET.length]).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function jsonPart(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signSocketToken(
  sessionId: string,
  role: "teacher" | "student",
  subjectId: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const secret = process.env.SOCKET_INTERNAL_SECRET?.trim();
  if (!secret || secret.length < 32) {
    fail("SOCKET_TOKEN_SIGNING_NOT_CONFIGURED", "Socket token signing is not configured.");
  }
  const header = jsonPart({ alg: "HS256", typ: "SVRT1" });
  const payload = jsonPart({ v: 1, sessionId, role, subjectId, exp: now + SOCKET_TOKEN_TTL_SECONDS });
  const input = `${header}.${payload}`;
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return `${input}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export const create = mutation({
  args: { title: v.optional(v.string()), subject: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    let joinCode = randomJoinCode();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_join_code", (q) => q.eq("joinCode", joinCode))
        .unique();
      if (!existing) break;
      if (attempt === 7) fail("JOIN_CODE_EXHAUSTED", "Could not allocate a room code.");
      joinCode = randomJoinCode();
    }

    const sessionId = await ctx.db.insert("sessions", {
      teacherId: teacher._id,
      title: normalizeTitle(args.title),
      subject: normalizeSubject(args.subject),
      joinCode,
      status: "draft",
      latestBoardVersion: 0,
    });
    return { sessionId, joinCode, status: "draft" as const };
  },
});

export const start = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    if (session.status === "live") {
      return { sessionId: session._id, joinCode: session.joinCode, status: "live" as const };
    }
    if (session.status !== "draft") fail("SESSION_NOT_STARTABLE", "This room cannot be started.");
    const startedAt = Date.now();
    await ctx.db.patch(session._id, { status: "live", startedAt });
    return { sessionId: session._id, joinCode: session.joinCode, status: "live" as const, startedAt };
  },
});

export const end = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    if (session.status === "ended") return { sessionId: session._id, status: "ended" as const };
    if (session.status === "ending") return { sessionId: session._id, status: "ending" as const };
    if (session.status !== "live") fail("SESSION_NOT_ENDABLE", "Only a live room can be ended.");
    // ending immediately revokes new join authorization; finalization is internal.
    await ctx.db.patch(session._id, { status: "ending" });
    await ctx.scheduler.runAfter(0, revokeRoom, { sessionId: session._id });
    await ctx.scheduler.runAfter(0, internal.sessions.finalize, { sessionId: session._id });
    return { sessionId: session._id, status: "ending" as const };
  },
});

/**
 * Persist the final board and begin ending, in one transaction.
 *
 * The two-call sequence (`boardSnapshots.saveFinal` then `sessions.end`) leaves
 * a window in which the save succeeds, the tab closes or the network drops, and
 * the room is ended with no board — or the save fails and the teacher retries
 * into a half-ended room. Convex mutations are transactional, so doing both here
 * means the room never reaches `ending` without its snapshot already durable.
 */
async function beginEndWithSnapshot(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  boardVersion: number,
  sceneJson: string,
) {
  if (session.status === "ended") return { sessionId: session._id, status: "ended" as const };
  if (session.status === "ending") return { sessionId: session._id, status: "ending" as const };
  if (session.status !== "live") fail("SESSION_NOT_ENDABLE", "Only a live room can be ended.");

  const { snapshotId } = await saveFinalSnapshot(ctx, session._id, boardVersion, sceneJson);
  await ctx.db.patch(session._id, { status: "ending" });
  await ctx.scheduler.runAfter(0, revokeRoom, { sessionId: session._id });
  await ctx.scheduler.runAfter(0, internal.sessions.finalize, { sessionId: session._id });
  return { sessionId: session._id, status: "ending" as const, snapshotId };
}

export const saveFinalAndEnd = mutation({
  args: { sessionId: v.id("sessions"), boardVersion: v.number(), sceneJson: v.string() },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    return await beginEndWithSnapshot(ctx, session, args.boardVersion, args.sceneJson);
  },
});

/**
 * Finalization must always terminate.
 *
 * `end` has already revoked every live socket and cleared relay hot state, so a
 * session left in `ending` can never be re-saved, re-ended, or exported — the
 * class is simply gone. Earlier this returned `FINAL_SNAPSHOT_MISSING` once and
 * stopped, which stranded the room permanently whenever the snapshot had not
 * landed. Now a bounded retry gives an in-flight save time to arrive, and the
 * room closes regardless once the attempts are spent.
 */
const FINALIZE_MAX_ATTEMPTS = 5;
const FINALIZE_RETRY_MS = 6_000;

/**
 * Record whether the relay accepted this room's socket revocation.
 *
 * Written by `internal/revokeRoom` after its retries settle. Passing `null`
 * clears a warning left by an earlier attempt, so a room that eventually
 * revoked does not keep advertising a failure that has resolved.
 */
export const recordRevocationOutcome = internalMutation({
  args: { sessionId: v.id("sessions"), warning: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    if (args.warning === null) {
      if (session.revocationWarning === undefined) return null;
      await ctx.db.patch(args.sessionId, { revocationWarning: undefined });
      return { sessionId: args.sessionId, cleared: true as const };
    }
    await ctx.db.patch(args.sessionId, { revocationWarning: args.warning });
    return { sessionId: args.sessionId, warning: args.warning };
  },
});

export const finalize = internalMutation({
  args: { sessionId: v.id("sessions"), attempt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "ending") return null;
    const attempt = args.attempt ?? 0;

    if (!session.latestSnapshotId) {
      if (attempt + 1 < FINALIZE_MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(FINALIZE_RETRY_MS, internal.sessions.finalize, {
          sessionId: session._id,
          attempt: attempt + 1,
        });
        return { sessionId: session._id, ok: false as const, reason: "FINAL_SNAPSHOT_PENDING" as const, attempt };
      }
      // Close the room with an explicit warning rather than stranding it. The
      // teacher loses the board, which is bad; leaving the room unusable and
      // un-exportable forever is worse, and hides the failure entirely.
      const endedAt = Date.now();
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt,
        finalizeWarning: "FINAL_SNAPSHOT_MISSING",
      });
      return { sessionId: session._id, ok: false as const, reason: "FINAL_SNAPSHOT_MISSING" as const, endedAt };
    }

    const endedAt = Date.now();
    await ctx.db.patch(session._id, { status: "ended", endedAt });
    // Notes are best-effort and strictly downstream: the board is already
    // durable at this point, so a missing key or a provider outage costs the
    // class nothing but the summary.
    await ctx.scheduler.runAfter(0, summarizeSession, { sessionId: session._id });
    return { sessionId: session._id, ok: true as const, endedAt };
  },
});

export const getJoinInfoByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    if (!JOIN_CODE_PATTERN.test(code)) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (!session || session.status !== "live") return null;
    return {
      sessionId: session._id,
      title: session.title,
      subject: session.subject,
      joinCode: session.joinCode,
      status: session.status,
    };
  },
});

export const getTeacherSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    return {
      sessionId: session._id,
      title: session.title,
      subject: session.subject,
      joinCode: session.joinCode,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      latestBoardVersion: session.latestBoardVersion,
      participantCount: session.studentCount ?? 0,
    };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const teacher = await requireTeacher(ctx);
    return await ctx.db
      .query("sessions")
      .withIndex("by_teacher_started", (q) => q.eq("teacherId", teacher._id))
      .order("desc")
      .take(100);
  },
});

async function buildTeacherDashboard(ctx: QueryCtx, teacherId: Id<"users">) {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_teacher_started", (q) => q.eq("teacherId", teacherId))
    .order("desc")
    .take(100);

  // One indexed take, no per-session fan-out. The participant collect that used to
  // live here made this reactive query re-read every participant of every class the
  // teacher owns whenever any doubt submission patched a lastSeenAt.
  const sessionStats = sessions.map((session) => ({
    sessionId: session._id,
    title: session.title,
    subject: session.subject,
    joinCode: session.joinCode,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    latestBoardVersion: session.latestBoardVersion,
    hasSavedBoard: session.latestSnapshotId !== undefined,
    studentCount: session.studentCount ?? 0,
  }));

  return {
    sessions: sessionStats,
    totals: {
      classCount: sessionStats.length,
      liveCount: sessionStats.filter((session) => session.status === "live").length,
      endedCount: sessionStats.filter((session) => session.status === "ended").length,
      studentJoins: sessionStats.reduce((total, session) => total + session.studentCount, 0),
      savedBoardCount: sessionStats.filter((session) => session.hasSavedBoard).length,
    },
  };
}

export const getTeacherDashboard = query({
  args: {},
  handler: async (ctx) => {
    const teacher = await requireTeacher(ctx);
    return await buildTeacherDashboard(ctx, teacher._id);
  },
});

export const listTeacherHistory = query({
  args: {},
  handler: async (ctx) => {
    const teacher = await requireTeacher(ctx);
    return await ctx.db
      .query("sessions")
      .withIndex("by_teacher_status", (q) => q.eq("teacherId", teacher._id).eq("status", "ended"))
      .order("desc")
      .take(100);
  },
});

export const issueSocketToken = action({
  args: {
    sessionId: v.id("sessions"),
    participantId: v.optional(v.id("participants")),
    /** Local/dev only: request teacher token for local-dev-teacher without Convex Auth. */
    asLocalTeacher: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const session: { _id: string; teacherId: string; status: string } | null = await ctx.runQuery(
      internal.sessions.getForToken,
      { sessionId: args.sessionId },
    );
    if (!session || session.status !== "live") {
      fail(session?.status === "ended" ? "SESSION_ENDED" : "SESSION_NOT_LIVE", "This room is not accepting joins.");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject) {
      const teacher: { _id: string; role: string } | null = await ctx.runQuery(
        internal.sessions.getTeacherForToken,
        { subject: identity.subject },
      );
      if (teacher && (teacher.role === "teacher" || teacher.role === "admin")) {
        if (teacher._id !== session.teacherId) fail("NOT_SESSION_OWNER", "You do not own this room.");
        return { token: await signSocketToken(session._id, "teacher", teacher._id) };
      }
    }

    if (args.asLocalTeacher) {
      if (!isLocalDevTeacherAllowed()) {
        fail("DEV_TEACHER_DISABLED", "Local teacher mode is disabled.");
      }
      const teacher: { _id: string; role: string; authSubject?: string } | null = await ctx.runQuery(
        internal.sessions.getTeacherForToken,
        { subject: LOCAL_DEV_TEACHER_SUBJECT },
      );
      if (!teacher || (teacher.role !== "teacher" && teacher.role !== "admin")) {
        fail("FORBIDDEN", "Local teacher is not bootstrapped.");
      }
      if (teacher._id !== session.teacherId) fail("NOT_SESSION_OWNER", "You do not own this room.");
      return { token: await signSocketToken(session._id, "teacher", teacher._id) };
    }

    if (!args.participantId) fail("FORBIDDEN", "A participant admission is required.");
    const participant: { participantId: string; sessionId: string; blockedUntil?: number } | null = await ctx.runQuery(
      internal.sessions.getParticipantForToken,
      { participantId: args.participantId },
    );
    if (!participant || participant.sessionId !== session._id) {
      fail("FORBIDDEN", "This participant is not admitted to the room.");
    }
    if (participant.blockedUntil !== undefined && participant.blockedUntil > Date.now()) {
      fail("PARTICIPANT_BLOCKED", "Joining is temporarily unavailable.");
    }
    return { token: await signSocketToken(session._id, "student", participant.participantId) };
  },
});

export const getForToken = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session ? { _id: session._id, teacherId: session.teacherId, status: session.status } : null;
  },
});

export const getTeacherForToken = internalQuery({
  args: { subject: v.string() },
  handler: async (ctx, args) => {
    // Local/dev identities and external issuers may use arbitrary subject
    // strings, so resolve the indexed auth subject before attempting a
    // Convex document lookup. `db.get` throws for malformed IDs.
    const byAuthSubject = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", args.subject))
      .unique();
    if (byAuthSubject) return byAuthSubject;

    // Convex Auth normally puts the user document id in the JWT subject. Keep
    // that compatibility path, but contain malformed/foreign subjects.
    try {
      return await ctx.db.get(args.subject as Id<"users">);
    } catch {
      return null;
    }
  },
});

export const getParticipantForToken = internalQuery({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    return participant ? { participantId: participant._id, sessionId: participant.sessionId, blockedUntil: participant.blockedUntil } : null;
  },
});

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 3, module: "sessions", ready: true }),
});
