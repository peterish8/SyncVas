/**
 * Shared presentation for the route-level error and not-found boundaries.
 *
 * Kept free of Convex and socket imports so it still renders when a provider is
 * the thing that failed.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export type FailureScreenProps = {
  title: string;
  message: string;
  recovery?: string;
  /** Stable support reference; never a stack trace. */
  reference?: string;
  actions?: ReactNode;
};

export function FailureScreen({ title, message, recovery, reference, actions }: FailureScreenProps) {
  return (
    <main className="syncvas-failure" role="main">
      <div className="syncvas-failure-card">
        <p className="syncvas-failure-eyebrow">Syncvas</p>
        <h1 className="syncvas-failure-title">{title}</h1>
        <p className="syncvas-failure-message">{message}</p>
        {recovery ? <p className="syncvas-failure-recovery">{recovery}</p> : null}
        <div className="syncvas-failure-actions">
          {actions}
          <Link className="syncvas-btn syncvas-btn-ghost" href="/">
            Go home
          </Link>
        </div>
        {reference ? (
          <p className="syncvas-failure-reference">
            Reference <code>{reference}</code>
          </p>
        ) : null}
      </div>
    </main>
  );
}
