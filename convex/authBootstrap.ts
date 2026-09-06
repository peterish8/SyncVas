/**
 * Local/dev teacher bootstrap for anonymous Convex (no Convex Auth identity).
 * Gated by ALLOW_DEV_TEACHER=1. Production path still uses requireTeacher + real auth.
 */


import { mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export const LOCAL_DEV_TEACHER_SUBJECT = "local-dev-teacher";

export function isLocalDevTeacherAllowed(
  envRecord: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  // This is intentionally a two-key opt-in. A copied flag must never enable
  // the anonymous teacher identity in a production Convex environment.
  return envRecord.NODE_ENV === "development" && envRecord.ALLOW_DEV_TEACHER === "1";
}

export async function upsertLocalDevTeacher(
  ctx: MutationCtx,
): Promise<Doc<"users">> {
  if (!isLocalDevTeacherAllowed()) {
    throw new Error(
      "DEV_TEACHER_DISABLED: Local teacher bootstrap is disabled. Set ALLOW_DEV_TEACHER=1 on the Convex deployment.",
    );
  }

  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", LOCAL_DEV_TEACHER_SUBJECT))
    .unique();
  if (existing) {
    if (existing.role !== "teacher" && existing.role !== "admin") {
      throw new Error("FORBIDDEN: Local bootstrap subject is not a teacher.");
    }
    return existing;
  }

  const now = Date.now();
  const teacherId = await ctx.db.insert("users", {
    authSubject: LOCAL_DEV_TEACHER_SUBJECT,
    name: "Local Teacher",
    role: "teacher",
    createdAt: now,
  });
  const teacher = await ctx.db.get(teacherId);
  if (!teacher) {
    throw new Error("INTERNAL: Failed to create local teacher.");
  }
  return teacher;
}

export async function getLocalDevTeacher(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  if (!isLocalDevTeacherAllowed()) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", LOCAL_DEV_TEACHER_SUBJECT))
    .unique();
}

/** Upsert the fixed local-dev-teacher user. Client calls this before local session lifecycle. */
export const ensureLocalTeacher = mutation({
  args: {},
  handler: async (ctx) => {
    const teacher = await upsertLocalDevTeacher(ctx);
    return {
      teacherId: teacher._id,
      authSubject: teacher.authSubject,
    };
  },
});
