/**
 * @scaffold true
 * @phase 6
 * Internal finalization
 *
 * Called only from internal/scheduled paths after public end.
 * Capture scene once; write storage + boardSnapshots; set session.ended.
 * Idempotent; resume interrupted finalization without duplicate finals.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { internalMutation } from "../_generated/server";

export const run = internalMutation({
  args: {},
  handler: async () => {
    // PHASE 6: real args + logic
    return { ok: false, reason: "scaffold" };
  },
});
