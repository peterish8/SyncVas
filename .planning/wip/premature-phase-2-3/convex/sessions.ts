import { createHmac } from "node:crypto";
import { v } from "convex/values";
import { action, internalMutation, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireTeacher } from "./auth";

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;
const JOIN_CODE_PATTERN = /^[A-Z2-9]{6}$/;
const SOCKET_TOKEN_TTL_SECONDS = 5 * 60;

function normalizeTitle(title: string | undefined): string {
  const value = title?.trim() ?? "";
  if (value.length > 120) throw new Error("TITLE_TOO_LONG");
  return value || "Untitled class";
}

function normalizeOptional(value: string | undefined, max: number): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > max) throw new Error("FIELD_TOO_LONG");
  return normalized;
}

function randomJoinCode(): string {
  const bytes = new Uint32Array(JOIN_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => JOIN_ALPHABET[byte % JOIN_ALPHABET.length]).join("");
}

function tokenPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function socketToken(sessionId: string, role: "teacher" | "student", subjectId: string, now = Math.floor(Date.now() / 1000)): string {
  const secret = process.env.SOCKET_INTERNAL_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SOCKET_TOKEN_SIGNING_NOT_CONFIGURED");
  const header = tokenPart({ alg: "HS256", typ: "SVRT1" });
  const payload = tokenPart({ v: 1, sessionId, role, subjectId, exp: now + SOCKET_TOKEN_TTL_SECONDS });
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");
  return `${input}.${signature}`;
}

export const create = mutation({
  args: { title: v.optional(v.string()), subject: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    let joinCode = randomJoinCode();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const taken = await ctx.db.query("sessions").withIndex("by_join_code", (q) => q.eq("joinCode", joinCode)).first();
      if (!taken) break;
      if (attempt === 7) throw new Error("JOIN_CODE_EXHAUSTED");
      joinCode = randomJoinCode();
    }
    const sessionId = await ctx.db.insert("sessions", {
      teacherId: teacher._id,
      title: normalizeTitle(args.title),
      subject: normalizeOptional(args.subject, 80),
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
    await requireTeacher(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    const teacher = await requireTeacher(ctx);
    if (session.teacherId !== teacher._id) throw new Error("NOT_SESSION_OWNER");
    if (session.status === "live") return { sessionId: session._id, joinCode: session.joinCode, status: session.status as "live" };
    if (session.status !== "draft") throw new Error("SESSION_NOT_STARTABLE");
    const startedAt = Date.now();
    await ctx.db.patch(session._id, { status: "live", startedAt });
    return { sessionId: session._id, joinCode: session.joinCode, status: "live" as const, startedAt };
  },
});

export const end = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.teacherId !== teacher._id) throw new Error("NOT_SESSION_OWNER");
    if (session.status === "ended") return { sessionId: session._id, status: session.status as "ended" };
    if (session.status !== "live") throw new Error("SESSION_NOT_ENDABLE");
    await ctx.db.patch(session._id, { status: "ending" });
    await ctx.scheduler.runAfter(0, internal.sessions.finalize, { sessionId: session._id });
    return { sessionId: session._id, status: "ending" as const };
  },
});

export const finalize = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "ending") return null;
    const endedAt = Date.now();
    await ctx.db.patch(session._id, { status: "ended", endedAt });
    return { sessionId: session._id, endedAt };
  },
});

export const getJoinInfoByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    if (!JOIN_CODE_PATTERN.test(code)) return null;
    const session = await ctx.db.query("sessions").withIndex("by_join_code", (q) => q.eq("joinCode", code)).unique();
    if (!session || session.status !== "live") return null;
    return { sessionId: session._id, title: session.title, subject: session.subject, joinCode: session.joinCode, status: session.status };
  },
});

export const getTeacherSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    if (session.teacherId !== teacher._id) throw new Error("NOT_SESSION_OWNER");
    const participantCount = await ctx.db.query("participants").withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect();
    return { sessionId: session._id, title: session.title, subject: session.subject, joinCode: session.joinCode, status: session.status, startedAt: session.startedAt, endedAt: session.endedAt, latestBoardVersion: session.latestBoardVersion, participantCount: participantCount.length };
  },
});

export const issueSocketToken = action({
  args: { sessionId: v.id("sessions"), participantId: v.optional(v.id("participants")) },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(internal.sessions.getForToken, { sessionId: args.sessionId });
    if (!session || session.status !== "live") throw new Error(session?.status === "ended" ? "SESSION_ENDED" : "SESSION_NOT_LIVE");
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject) {
      const teacher = await ctx.runQuery(internal.auth.getBySubject, { subject: identity.subject });
      if (teacher && teacher.role === "teacher" || teacher?.role === "admin") {
        if (teacher._id !== session.teacherId) throw new Error("NOT_SESSION_OWNER");
        return { token: socketToken(session._id, "teacher", teacher._id) };
      }
    }
    if (!args.participantId) throw new Error("FORBIDDEN");
    const participant = await ctx.runQuery(internal.sessions.getParticipantForToken, { participantId: args.participantId });
    if (!participant || participant.sessionId !== session._id) throw new Error("FORBIDDEN");
    return { token: socketToken(session._id, "student", participant.participantId) };
  },
});

export const getForToken = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session ? { _id: session._id, teacherId: session.teacherId, status: session.status } : null;
  },
});

export const getParticipantForToken = query({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    return participant ? { participantId: participant._id, sessionId: participant.sessionId } : null;
  },
});
