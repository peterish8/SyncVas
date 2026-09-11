"use client";

/**
 * Route-level error boundary.
 *
 * Without this, an uncaught render error in a classroom route shows Next's raw
 * error screen in production. Teachers hit this mid-lesson, so the copy points
 * at recovery rather than at the fault.
 */

import { useEffect } from "react";

import { FailureScreen } from "@/components/ui/failure-screen";
import { toUserFacingError } from "@/lib/user-facing-errors";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe correlation handle: the message itself may
    // carry board or doubt text, which must never reach a log sink.
    console.error("[syncvas] route error", { digest: error.digest });
  }, [error]);

  const friendly = toUserFacingError(error, "Something went wrong on this page.");

  return (
    <FailureScreen
      title="This page hit a problem"
      message={friendly.message}
      recovery={friendly.recovery ?? "Your saved boards are unaffected. Try again, or go back to your dashboard."}
      reference={error.digest}
      actions={
        <button className="syncvas-btn syncvas-btn-primary" onClick={reset} type="button">
          Try again
        </button>
      }
    />
  );
}
