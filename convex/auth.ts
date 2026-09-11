/**
 * Convex Auth — Google OAuth for teachers.
 * Permission helpers live in ./permissions.ts (do not scatter provider checks).
 */

import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function ensureTeacherProfile(
  ctx: MutationCtx,
  userId: Id<"users">,
  profile: { name?: string | null; email?: string | null; image?: string | null },
) {
  const existing = await ctx.db.get(userId);
  if (!existing) return;

  const patch: {
    name?: string;
    email?: string;
    image?: string;
    role?: "teacher";
    createdAt?: number;
    authSubject?: string;
  } = {};

  if (!existing.role) patch.role = "teacher";
  if (existing.createdAt === undefined) patch.createdAt = Date.now();
  if (!existing.authSubject) patch.authSubject = userId;
  if (profile.name && !existing.name) patch.name = profile.name;
  if (profile.email && !existing.email) patch.email = profile.email;
  if (profile.image && !existing.image) patch.image = profile.image;

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(userId, patch);
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        await ensureTeacherProfile(ctx, args.existingUserId, args.profile);
        return args.existingUserId;
      }

      // Google-only MVP: Convex Auth links via authAccounts; skip email scans.
      const email = typeof args.profile.email === "string" ? args.profile.email : undefined;
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        name: typeof args.profile.name === "string" ? args.profile.name : undefined,
        email,
        image: typeof args.profile.image === "string" ? args.profile.image : undefined,
        emailVerificationTime: email ? now : undefined,
        role: "teacher",
        createdAt: now,
        // Placeholder; patched to document id immediately below for stable lookups.
        authSubject: "pending",
      });
      await ctx.db.patch(userId, { authSubject: userId });
      return userId;
    },
  },
});
