/**
 * @scaffold true
 * @phase 6
 * Final board persistence API
 *
 * Public: teacher requests finalize; students never call.
 * Store large scenes in _storage; boardSnapshots hold metadata + storageId.
 * Idempotent finalize; no HF pen pointer documents.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { query } from "./_generated/server";

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 6, module: "board", ready: false }),
});
