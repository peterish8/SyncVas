/**
 * @scaffold true
 * @phase 10
 * Live provider wiring
 *
 * Select ONE approved provider at execution time; document ADR.
 * Export factory createLiveModerationAdapter() reading server env only.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import type { ModerationAdapter } from "../moderation-adapter";
import { DisabledModerationAdapter } from "../moderation-adapter";

export function createLiveModerationAdapter(): ModerationAdapter {
  // PHASE 10: construct provider client from process.env.* (server-only)
  return new DisabledModerationAdapter();
}
