"use client";

import Link from "next/link";

export function TeacherSignInCard() {
  return (
    <div className="grid gap-5">
      <div className="syncvas-sunken grid gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="syncvas-auth-mark syncvas-auth-mark-accent" aria-hidden="true">
            S
          </span>
          <div>
            <p className="syncvas-eyebrow">Teacher access</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">
              Sign in to teach
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Your account keeps classrooms, saved boards, and lesson drafts together.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="syncvas-btn syncvas-btn-secondary w-full"
          disabled
          aria-describedby="google-sign-in-status"
        >
          <span className="syncvas-google-mark" aria-hidden="true">
            G
          </span>
          Continue with Google
        </button>
        <p id="google-sign-in-status" className="syncvas-hint">
          Google sign-in is ready for configuration. Add the Google client ID and secret before
          enabling production access.
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs text-ink-subtle" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span>development only</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Link href="/teacher?mode=local" className="syncvas-btn syncvas-btn-ghost w-full">
        Continue as local teacher
      </Link>
      <p className="text-center text-xs leading-5 text-ink-subtle">
        Local mode uses a fixed development identity and must stay disabled in production.
      </p>

      <p className="text-center text-xs text-ink-subtle">
        Need to join a class?{" "}
        <Link href="/join" className="font-medium text-ink underline-offset-2 hover:underline">
          Join as a student
        </Link>
      </p>
    </div>
  );
}
