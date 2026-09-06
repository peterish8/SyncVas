/** Durable classroom session lifecycle and server-issued socket admission. */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import {
  isLocalDevTeacherAllowed,
  requireLocalDevSessionOwner,
  requireLocalDevSessionOwnerQuery,
  requireLocalDevTeacher,
  requireSessionOwner,
  requireTeacher,
  getLocalDevTeacher,
} from "./auth";
import { LOCAL_DEV_TEACHER_SUBJECT } from "./authBootstrap";

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_PATTERN = /^[A-Z2-9]{6}$/;
const JOIN_CODE_LENGTH = 6;
const SOCKET_TOKEN_TTL_SECONDS = 5 * 60;
const revokeRoom = (internal as unknown as {
  "internal/revokeRoom": { run: FunctionReference<"action", "internal", { sessionId: Id<"sessions"> }, unknown> };
})["internal/revokeRoom"].run;

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`);
}

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

/** Local/dev: create draft session as local-dev-teacher without Convex Auth identity. */
export const createAsLocalTeacher = mutation({
  args: { title: v.optional(v.string()), subject: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const teacher = await requireLocalDevTeacher(ctx);
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
    return {
      sessionId,
      joinCode,
      status: "draft" as const,
      teacherId: teacher._id,
      authSubject: LOCAL_DEV_TEACHER_SUBJECT,
    };
  },
});

export const startAsLocalTeacher = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireLocalDevSessionOwner(ctx, args.sessionId);
    if (session.status === "live") {
      return { sessionId: session._id, joinCode: session.joinCode, status: "live" as const };
    }
    if (session.status !== "draft") fail("SESSION_NOT_STARTABLE", "This room cannot be started.");
    const startedAt = Date.now();
    await ctx.db.patch(session._id, { status: "live", startedAt });
    return { sessionId: session._id, joinCode: session.joinCode, status: "live" as const, startedAt };
  },
});

export const endAsLocalTeacher = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireLocalDevSessionOwner(ctx, args.sessionId);
    if (session.status === "ended") return { sessionId: session._id, status: "ended" as const };
    if (session.status === "ending") return { sessionId: session._id, status: "ending" as const };
    if (session.status !== "live") fail("SESSION_NOT_ENDABLE", "Only a live room can be ended.");
    await ctx.db.patch(session._id, { status: "ending" });
    await ctx.scheduler.runAfter(0, revokeRoom, { sessionId: session._id });
    await ctx.scheduler.runAfter(0, internal.sessions.finalize, { sessionId: session._id });
    return { sessionId: session._id, status: "ending" as const };
  },
});

export const finalize = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "ending") return null;
    if (!session.latestSnapshotId) {
      return { sessionId: session._id, ok: false as const, reason: "FINAL_SNAPSHOT_MISSING" as const };
    }
    const endedAt = Date.now();
    await ctx.db.patch(session._id, { status: "ended", endedAt });
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
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    return {
      sessionId: session._id,
      title: session.title,
      subject: session.subject,
      joinCode: session.joinCode,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      latestBoardVersion: session.latestBoardVersion,
      participantCount: participants.length,
    };
  },
});

export const getLocalTeacherSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireLocalDevSessionOwnerQuery(ctx, args.sessionId);
    return { sessionId: session._id, title: session.title, subject: session.subject, joinCode: session.joinCode, status: session.status, startedAt: session.startedAt, endedAt: session.endedAt, latestBoardVersion: session.latestBoardVersion };
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

export const listTeacherHistoryAsLocalTeacher = query({
  args: {},
  handler: async (ctx) => {
    const teacher = await getLocalDevTeacher(ctx);
    if (!teacher) return [];
    return await ctx.db.query("sessions").withIndex("by_teacher_status", (q) => q.eq("teacherId", teacher._id).eq("status", "ended")).order("desc").take(100);
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
    return await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", args.subject))
      .unique();
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
