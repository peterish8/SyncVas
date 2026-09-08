"use client";

import { LOCAL_TEACHER_ENABLED } from "@/lib/teacher-access";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

import { SyncvasMark } from "@/components/ui/syncvas-logo";

function GoogleGlyph() {
  return (
    <svg className="syncvas-google-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.74-.07-1.45-.21-2.13H12v4.03h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.29Z"
      />
      <path fill="#34A853" d="M12 21.99c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.27v2.53A9.74 9.74 0 0 0 12 21.99Z" />
      <path fill="#FBBC05" d="M6.51 14.07A5.86 5.86 0 0 1 6.2 12c0-.72.12-1.42.31-2.07V7.4H3.27A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.02 4.6l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 5.9c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.83 2.93 14.62 2 12 2a9.74 9.74 0 0 0-8.73 5.4l3.24 2.53C7.29 7.62 9.45 5.9 12 5.9Z" />
    </svg>
  );
}

const googleConfigured = Boolean(
  process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_CONVEX_URL,
);

export function TeacherSignInCard() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localTeacherEnabled = LOCAL_TEACHER_ENABLED;

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/teacher/dashboard");
    }
  }, [isAuthenticated, router]);

  async function handleGoogleSignIn() {
    setError(null);
    setPending(true);
    try {
      await signIn("google", { redirectTo: "/teacher/dashboard" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(message);
      setPending(false);
    }
  }

  return (
    <div className="syncvas-auth-form">
      <div className="syncvas-auth-form-brand lg:hidden">
        <span className="syncvas-auth-mark syncvas-auth-mark-accent" aria-hidden="true">
          <SyncvasMark />
        </span>
        <p className="text-lg font-semibold tracking-[-0.04em]">Syncvas</p>
      </div>

      <div className="syncvas-auth-form-header">
        <p className="syncvas-eyebrow">Teacher access</p>
        <h1 id="teacher-sign-in-title" className="syncvas-auth-form-title">
          Sign in to teach
        </h1>
        <p className="syncvas-auth-form-lead">
          Open your teacher workspace and pick up where the lesson left off.
        </p>
      </div>

      <div className="syncvas-auth-form-actions">
        <button
          type="button"
          className="syncvas-btn syncvas-btn-primary w-full"
          disabled={!googleConfigured || pending || isLoading || isAuthenticated}
          aria-describedby={error || !googleConfigured ? "google-sign-in-status" : undefined}
          onClick={() => void handleGoogleSignIn()}
        >
          <span className="syncvas-google-mark" aria-hidden="true">
            <GoogleGlyph />
          </span>
          {pending ? "Redirecting to Google…" : "Continue with Google"}
        </button>
        {error || !googleConfigured ? (
          <p id="google-sign-in-status" className="syncvas-hint" aria-live="polite" role={error ? "alert" : undefined}>
            {error ?? "Google sign-in is not configured yet."}
          </p>
        ) : null}
      </div>

      {localTeacherEnabled ? (
        <>
          <div className="syncvas-auth-separator" aria-hidden="true">
            <span />
            <em>or</em>
            <span />
          </div>

          <Link href="/teacher?mode=local" className="syncvas-btn syncvas-btn-secondary w-full">
            Continue as local teacher
          </Link>
        </>
      ) : null}

      <p className="syncvas-auth-form-foot">
        Need to join a class?{" "}
        <Link href="/join" className="font-medium text-ink underline-offset-2 hover:underline">
          Join as a student
        </Link>
      </p>

      <p className="syncvas-auth-legal">
        By continuing, you agree to the Syncvas classroom terms.
      </p>
    </div>
  );
}
