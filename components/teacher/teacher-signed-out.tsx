/**
 * Permission state for teacher-only routes.
 *
 * Convex `useQuery` rethrows during render, so a `requireTeacher` query run
 * while signed out takes the route to `app/error.tsx` — a generic failure
 * screen for what is really an ordinary "please sign in". These routes skip the
 * query instead and render this.
 */

"use client";

import Link from "next/link";

export function TeacherSignedOut({
  surface,
  resolving = false,
}: {
  /** What the teacher was trying to reach, e.g. "your dashboard". */
  surface: string;
  /** Convex Auth has not answered yet; say so rather than claiming signed out. */
  resolving?: boolean;
}) {
  if (resolving) {
    return (
      <section className="mt-8 rounded-surface border border-border bg-canvas px-6 py-10 text-center" aria-busy="true">
        <p className="text-sm text-ink-muted">Checking your teacher account…</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-surface border border-dashed border-border bg-canvas px-6 py-10 text-center">
      <p className="text-sm font-medium">Sign in to see {surface}</p>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Classes are tied to your teacher account, so this page stays empty until you sign in.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/teacher/sign-in" className="syncvas-btn syncvas-btn-primary inline-flex">
          Teacher sign in
        </Link>
        <Link href="/" className="syncvas-btn syncvas-btn-ghost inline-flex">
          Back to home
        </Link>
      </div>
    </section>
  );
}
