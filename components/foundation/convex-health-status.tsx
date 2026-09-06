"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

export function ConvexHealthStatus({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-lime ring-1 ring-ink/15" />
        <div>
          <p className="font-medium">Convex</p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">Configured in source. Run <code className="font-mono text-xs text-ink">npx convex dev</code> to link a deployment and enable the health query.</p>
        </div>
      </div>
    );
  }

  return <ConnectedConvexHealth />;
}

function ConnectedConvexHealth() {
  const health = useQuery(api.health.status);
  const ready = health?.status === "ready";

  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${ready ? "bg-green" : "bg-lime ring-1 ring-ink/15"}`} />
      <div>
        <p className="font-medium">Convex</p>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{ready ? "Health query is responding from the configured deployment." : "Connecting to the configured deployment…"}</p>
      </div>
    </div>
  );
}
