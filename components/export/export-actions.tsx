"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";

export function ExportActions({ sessionId }: { sessionId: string }) {
  const request = useMutation(api.exports.request);
  const [busy, setBusy] = useState(false);
  async function onExport() { setBusy(true); try { await request({ sessionId: sessionId as Id<"sessions">, type: "png" }); } finally { setBusy(false); } }
  return <button type="button" disabled={busy} className="syncvas-btn syncvas-btn-secondary syncvas-btn-sm" onClick={() => void onExport()}>{busy ? "Queuing…" : "Export board"}</button>;
}
