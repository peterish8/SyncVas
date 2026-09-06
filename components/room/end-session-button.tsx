/**
 * End class control — local-dev teacher path when Convex Auth is absent.
 */

"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { roomTokenStorageKey } from "@/lib/local-teacher";
import { useMutation } from "convex/react";
import { useState } from "react";

export function EndSessionButton({
  sessionId,
  onEnded,
}: {
  sessionId: string;
  onEnded?: () => void;
}) {
  const endLocal = useMutation(api.sessions.endAsLocalTeacher);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEnd() {
    setBusy(true);
    setError(null);
    try {
      await endLocal({ sessionId: sessionId as Id<"sessions"> });
      window.sessionStorage.removeItem(roomTokenStorageKey(sessionId));
      onEnded?.();
    } catch {
      setError("Could not end the room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className="syncvas-btn syncvas-btn-secondary"
        disabled={busy}
        onClick={() => void onEnd()}
      >
        End class
      </button>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-2 py-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
