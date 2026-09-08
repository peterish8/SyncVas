/**
 * Auth helpers (Convex Auth abstraction)
 *
 * Resolve identity from ctx.auth — NEVER trust client-provided teacherId/role.
 *
 * This is the single seam at which teacher identity is decided. It used to be
 * decided per function: every teacher operation shipped a `*AsLocalTeacher`
 * twin, 30 of them across 9 modules, and the two families drifted — the doubts
 * queue twins ran different queries and returned different rows, and nothing
 * compared them. The dev fallback now lives here, so each operation has one
 * body and one interface.
 *
 * The production gate is unchanged and still two-key: `isLocalDevTeacherAllowed`
 * requires NODE_ENV=development *and* ALLOW_DEV_TEACHER=1, and
 * `lib/production-env.ts` rejects the flag on a real deploy.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getLocalDevTeacher, isLocalDevTeacherAllowed } from "./authBootstrap";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireAuthSubject(ctx: AuthCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId) return userId;

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
  const userId = await getAuthUserId(ctx);
  if (userId) {
    const user = await ctx.db.get(userId);
    if (!user || (user.role !== "teacher" && user.role !== "admin")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "A teacher account is required.",
      });
    }
    return user;
  }

  // No Convex Auth identity. In a development deployment with the dev teacher
  // enabled, fall back to it rather than making every caller ask. Read-only:
  // the row is created by the `authBootstrap.ensureLocalTeacher` mutation, which
  // the teacher surface already calls before any room lifecycle action.
  if (isLocalDevTeacherAllowed()) {
    const local = await getLocalDevTeacher(ctx);
    if (local && (local.role === "teacher" || local.role === "admin")) return local;
    throw new ConvexError({
      code: "DEV_TEACHER_NOT_BOOTSTRAPPED",
      message: "Continue as local teacher first.",
    });
  }

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

/**
 * The student-side authorization check.
 *
 * `participantId` is an unguessable capability handed out by `joinByCode` and
 * held in the browser — anonymous join means there is no account to check
 * against. Every student-facing read or write must still prove the participant
 * belongs to *this* room and is not blocked, or one room's ID becomes a key to
 * another room's contents.
 */
export async function requireParticipantInSession(
  ctx: AuthCtx,
  sessionId: Id<"sessions">,
  participantId: Id<"participants">,
): Promise<Doc<"participants">> {
  const participant = await ctx.db.get(participantId);
  if (!participant || participant.sessionId !== sessionId) {
    throw new ConvexError({ code: "FORBIDDEN", message: "You are not admitted to this room." });
  }
  if (participant.blockedUntil !== undefined && participant.blockedUntil > Date.now()) {
    throw new ConvexError({ code: "PARTICIPANT_BLOCKED", message: "Joining is temporarily unavailable." });
  }
  return participant;
}

export { getLocalDevTeacher, isLocalDevTeacherAllowed };
