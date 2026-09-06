/**
 * Live coarse participant count — room-scoped only; no student identities.
 */

"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";

export function ParticipantCount({ sessionId }: { sessionId: string }) {
  const result = useQuery(api.participants.countForSession, {
    sessionId: sessionId as Id<"sessions">,
  });
  const count = result?.connectedCount;
  const label =
    count === undefined ? "…" : count === 1 ? "1 student" : `${count} students`;

  return (
    <span
      className="syncvas-pill tabular-nums text-ink"
      data-session={sessionId}
      aria-live="polite"
    >
      {label}
    </span>
  );
}
