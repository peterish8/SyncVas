import { query, mutation } from "./_generated/server";
import type { DatabaseReader, DatabaseWriter } from "./_generated/server";

type AuthContext = {
  auth: { getUserIdentity: () => Promise<{ subject?: string; email?: string; name?: string } | null> };
  db: DatabaseReader | DatabaseWriter;
};

export type TeacherRecord = {
  _id: any;
  authSubject: string;
  role: "teacher" | "admin";
  email?: string;
  name?: string;
  createdAt: number;
};

/** Resolve the provider-neutral identity exposed by Convex Auth. */
export async function requireTeacher(ctx: AuthContext): Promise<TeacherRecord> {
  const identity = await ctx.auth.getUserIdentity();
  const subject = identity?.subject?.trim();
  if (!subject) throw new Error("UNAUTHENTICATED");

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", subject))
    .unique();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const subject = identity?.subject?.trim();
    if (!subject) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", subject))
      .unique();
    return user ? { name: user.name, email: user.email, role: user.role } : null;
  },
});

/** Local-MVP bootstrap: the auth provider remains the source of identity. */
export const ensureCurrentTeacher = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const subject = identity?.subject?.trim();
    if (!subject) throw new Error("UNAUTHENTICATED");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", subject))
      .unique();
    if (existing) {
      if (existing.role !== "teacher" && existing.role !== "admin") throw new Error("FORBIDDEN");
      return { userId: existing._id };
    }
    const userId = await ctx.db.insert("users", {
      authSubject: subject,
      email: identity.email,
      name: identity.name,
      role: "teacher",
      createdAt: Date.now(),
    });
    return { userId };
  },
});
