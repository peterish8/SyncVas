/**
 * Teacher viewer profile for workspace chrome.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { getLocalDevTeacher } from "./authBootstrap";

export const getViewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId) {
      const user = await ctx.db.get(userId);
      if (user && (user.role === "teacher" || user.role === "admin")) {
        return {
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          role: user.role,
          mode: "auth" as const,
        };
      }
    }

    const local = await getLocalDevTeacher(ctx);
    if (local) {
      return {
        name: local.name ?? "Local Teacher",
        email: local.email ?? null,
        image: null,
        role: local.role,
        mode: "local" as const,
      };
    }

    return null;
  },
});
