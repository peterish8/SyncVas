import type { Metadata } from "next";

import { AppShell } from "@/components/ui/app-shell";
import { TeacherSignInCard } from "@/components/teacher/teacher-sign-in-card";

export const metadata: Metadata = {
  title: "Teacher sign in",
  description: "Sign in to create and manage Syncvas classrooms.",
  robots: { index: false, follow: false },
};

export default function TeacherSignInPage() {
  return (
    <AppShell title="Teacher sign in" trailing={null}>
      <div className="grid flex-1 place-items-center px-5 py-10 sm:px-8">
        <section className="w-full max-w-md" aria-labelledby="teacher-sign-in-title">
          <div className="mb-6 text-center">
            <p className="syncvas-eyebrow">Syncvas classroom</p>
            <h1 id="teacher-sign-in-title" className="mt-3 text-3xl font-semibold tracking-[-0.055em]">
              Start with a calm classroom.
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-ink-muted">
              Sign in once, then open a board, share the QR code, and keep the finished lesson.
            </p>
          </div>
          <div className="syncvas-panel p-5 sm:p-6">
            <TeacherSignInCard />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
