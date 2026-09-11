/**
 * Route-level loading placeholder.
 *
 * Server-rendered classroom routes previously painted nothing while the server
 * worked, which reads as a dead tap on a phone. The shimmer collapses under the
 * global `prefers-reduced-motion` rule in app/styles/base.css.
 */

export function RouteSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className="syncvas-route-skeleton" role="status" aria-live="polite">
      <span className="syncvas-sr-only">{label}</span>
      <div className="syncvas-dashboard-loading" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
