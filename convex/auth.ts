/**
 * Auth helpers (Convex Auth abstraction)
 *
 * Resolve identity from ctx.auth — NEVER trust client-provided teacherId/role.
 * Local/dev anonymous Convex uses authBootstrap + *AsLocalTeacher mutations
 * gated by ALLOW_DEV_TEACHER; production still uses requireTeacher.
 */

import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getLocalDevTeacher,
  isLocalDevTeacherAllowed,
  upsertLocalDevTeacher,
} from "./authBootstrap";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireAuthSubject(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  const subject = identity?.subject;
  if (!subject) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to manage a classroom.",
    });
  }
  return subject;
}

export async function requireTeacher(ctx: AuthCtx): Promise<Doc<"users">> {
  const subject = await requireAuthSubject(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", subject))
    .unique();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "A teacher account is required.",
    });
  }
  return user;
}

export async function requireSessionOwner(ctx: AuthCtx, sessionId: Id<"sessions">) {
  const teacher = await requireTeacher(ctx);
  const session = await ctx.db.get(sessionId);
  if (!session || session.teacherId !== teacher._id) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Classroom not found." });
  }
  return { teacher, session };
}

/** Local/dev only: teacher row for subject local-dev-teacher when ALLOW_DEV_TEACHER=1. */
export async function requireLocalDevTeacher(ctx: MutationCtx): Promise<Doc<"users">> {
  if (!isLocalDevTeacherAllowed()) {
    throw new ConvexError({
      code: "DEV_TEACHER_DISABLED",
      message: "Local teacher mode is disabled.",
    });
  }
  return await upsertLocalDevTeacher(ctx);
}

export async function requireLocalDevSessionOwner(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
) {
  const teacher = await requireLocalDevTeacher(ctx);
  const session = await ctx.db.get(sessionId);
  if (!session || session.teacherId !== teacher._id) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Classroom not found." });
  }
  return { teacher, session };
}

export async function requireLocalDevSessionOwnerQuery(ctx: QueryCtx, sessionId: Id<"sessions">) {
  const teacher = await getLocalDevTeacher(ctx);
  const session = await ctx.db.get(sessionId);
  if (!teacher || !session || session.teacherId !== teacher._id) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Classroom not found." });
  }
  return { teacher, session };
}

export { getLocalDevTeacher, isLocalDevTeacherAllowed };
