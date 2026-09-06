/**
 * @scaffold true
 * @phase 9
 * Adversarial permission suite
 *
 * Forged roles, token mismatch, cross-room, student board mutate, Convex ownership,
 * exports/history access, no secrets in browser bundle.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { describe, it, expect } from "vitest";

describe.skip("SEC permission boundaries (Phase 9)", () => {
  it("scaffold", () => {
    expect(true).toBe(true);
  });
});
