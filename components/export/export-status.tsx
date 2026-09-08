"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";

export function ExportStatus({ sessionId }: { sessionId: string }) {
  const jobs = useQuery(api.exports.getForSession, { sessionId: sessionId as Id<"sessions"> });
  const latest = jobs?.[0];
  return <span className="text-xs text-ink-muted" aria-live="polite">Export: {latest?.status ?? "—"}</span>;
}
