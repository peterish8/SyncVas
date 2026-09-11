/**
 * @phase 8
 * Degraded connection indicator
 *
 * Show only when socket degraded/reconnecting — not during healthy class.
 */

"use client";

export function ConnectionChip({ state }: { state: "ok" | "degraded" | "offline" }) {
  if (state === "ok") return null;

  const label = state === "offline" ? "Offline" : "Reconnecting…";
  const className =
    state === "offline" ? "syncvas-pill syncvas-pill-danger" : "syncvas-pill syncvas-pill-warning";

  return (
    <span className={className} role="status" aria-live="polite">
      {state === "degraded" ? <span className="syncvas-live-dot" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
