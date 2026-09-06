"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/ui/app-shell";

export default function TeacherHistoryPage() {
  const history = useQuery(api.sessions.listTeacherHistoryAsLocalTeacher, {});
  return (
    <AppShell title="History" trailing={<Link href="/teacher" className="syncvas-btn syncvas-btn-ghost min-h-9 px-3 text-sm">Live class</Link>}>
      <section className="flex flex-1 flex-col px-6 py-10 sm:px-10">
        <h1 className="text-3xl font-semibold tracking-[-0.05em]">Class history</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-ink-muted">Ended classes and their final board state.</p>
        {!history?.length ? (
          <div className="mt-8 rounded-surface border border-dashed border-border bg-canvas px-6 py-10 text-center">
            <p className="text-sm font-medium">No classes yet</p>
            <p className="mt-2 text-sm text-ink-muted">Start a live class, then end it to see it here.</p>
            <Link href="/teacher" className="syncvas-btn syncvas-btn-primary mt-6 inline-flex">Start class</Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {history.map((session) => <li key={session._id} className="rounded-2xl border border-border bg-surface p-4"><p className="font-medium">{session.title}</p><p className="mt-1 text-xs text-ink-muted">Code {session.joinCode} · {session.endedAt ? new Date(session.endedAt).toLocaleString() : "Ended"}</p><p className="mt-3 text-xs text-ink-muted">Final board v{session.latestBoardVersion} saved</p></li>)}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
