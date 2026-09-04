"use client";

import { BoardCanvas } from "@/components/board/board-canvas";

export function BoardRoom({ sessionId, role, teacherProofToken }: { sessionId: string; role: "teacher" | "student"; teacherProofToken?: string }) {
  const isTeacher = role === "teacher";
  return (
    <main className="flex min-h-svh flex-col bg-canvas px-4 py-4 sm:px-6 sm:py-6">
      <header className="mx-auto flex w-full max-w-[110rem] items-center justify-between gap-4 pb-4">
        <div>
          <a href="/" className="text-lg font-bold tracking-[-0.04em]">Syncvas</a>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            {isTeacher ? "Teaching room" : "Classroom viewer"} · {sessionId}
          </p>
        </div>
        <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted">
          {isTeacher ? "Teacher" : "Read only"}
        </span>
      </header>
      <section className="mx-auto flex min-h-0 w-full max-w-[110rem] flex-1 flex-col" aria-label={isTeacher ? "Teacher whiteboard" : "Student whiteboard"}>
          <BoardCanvas sessionId={sessionId} role={role} teacherProofToken={teacherProofToken} />
      </section>
    </main>
  );
}
