"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TeacherWorkspaceShell } from "@/components/teacher/teacher-workspace-shell";
import { TeacherNotesPanel } from "@/components/summary/teacher-notes-panel";
import { TeacherSignedOut } from "@/components/teacher/teacher-signed-out";
import { canRunTeacherQuery, teacherQueryArgs, useTeacherAccess } from "@/lib/teacher-access";

export default function TeacherHistoryPage() {
  const access = useTeacherAccess();
  const history = useQuery(
    api.sessions.listTeacherHistory,
    teacherQueryArgs(access, {}),
  );
  return (
    <TeacherWorkspaceShell
      title="History"
      trailing={
        <div className="flex items-center gap-2">
          <Link href="/teacher" className="syncvas-btn syncvas-btn-accent syncvas-btn-sm">
            New class
          </Link>
          <Link href="/teacher/dashboard" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm">
            Dashboard
          </Link>
        </div>
      }
    >
      <section className="flex flex-1 flex-col">
        <h1 className="text-3xl font-semibold tracking-[-0.05em]">Class history</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-ink-muted">Ended classes and their final board state.</p>
        {!canRunTeacherQuery(access) ? (
          <TeacherSignedOut surface="your class history" resolving={access === "resolving"} />
        ) : history === undefined ? (
          <div
            className="mt-8 rounded-surface border border-border bg-canvas px-6 py-10 text-center"
            aria-busy="true"
          >
            <p className="text-sm text-ink-muted">Loading your ended classes…</p>
          </div>
        ) : history.length === 0 ? (
          <div className="mt-8 rounded-surface border border-dashed border-border bg-canvas px-6 py-10 text-center">
            <p className="text-sm font-medium">No classes yet</p>
            <p className="mt-2 text-sm text-ink-muted">Start a live class, then end it to see it here.</p>
            <Link href="/teacher" className="syncvas-btn syncvas-btn-primary mt-6 inline-flex">Start class</Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {history.map((session) => (
              <li key={session._id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                <p className="font-medium">{session.title}</p>
                <p className="mt-1 text-xs text-ink-muted">Code {session.joinCode} · {session.endedAt ? new Date(session.endedAt).toLocaleString() : "Ended"}</p>
                <p className="mt-3 text-xs text-ink-muted">Final board v{session.latestBoardVersion} saved</p>
                <div className="mt-4">
                  <TeacherNotesPanel sessionId={session._id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </TeacherWorkspaceShell>
  );
}
