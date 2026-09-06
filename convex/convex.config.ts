import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    /** Shared secret for SVRT1 room tokens (min 32 chars). */
    SOCKET_INTERNAL_SECRET: v.optional(v.string()),
    /** Enable local-dev teacher bootstrap without Convex Auth (set to "1"). */
    ALLOW_DEV_TEACHER: v.optional(v.string()),
    /** Private URL used by the scheduled room-revocation action. */
    SOCKET_SERVICE_INTERNAL_URL: v.optional(v.string()),
  },
});

export default app;
