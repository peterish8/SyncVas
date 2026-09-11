/**
 * @phase 8
 * Reconnect / resync UX
 *
 * On reconnect: refresh token → rejoin room → board:request-current → reconcile version.
 */

"use client";

export function ReconnectBanner({
  onRetry,
  message = "Connection lost. The board will catch up when you reconnect.",
  busy = false,
}: {
  onRetry?: () => void;
  message?: string;
  busy?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning-ink)]"
      role="status"
      aria-live="polite"
    >
      <p className="min-w-0 flex-1 leading-5">{busy ? "Reconnecting…" : message}</p>
      {onRetry ? (
        <button
          type="button"
          className="syncvas-btn syncvas-btn-secondary syncvas-btn-sm shrink-0"
          disabled={busy}
          onClick={onRetry}
        >
          {busy ? "Working…" : "Reconnect"}
        </button>
      ) : null}
    </div>
  );
}
