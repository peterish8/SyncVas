/**
 * @scaffold true
 * @phase 8
 * Degraded connection indicator
 *
 * Show only when socket degraded/reconnecting — not during healthy class.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

export function ConnectionChip({ state }: { state: "ok" | "degraded" | "offline" }) {
  if (state === "ok") return null;
  return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs">{state}</span>;
}
