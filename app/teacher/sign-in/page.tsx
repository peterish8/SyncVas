import type { Metadata } from "next";
import Link from "next/link";

import { TeacherAuthVisual } from "@/components/teacher/teacher-auth-visual";
import { TeacherSignInCard } from "@/components/teacher/teacher-sign-in-card";

export const metadata: Metadata = {
  title: "Teacher sign in",
  description: "Sign in to create and manage Syncvas classrooms.",
  robots: { index: false, follow: false },
};

export default function TeacherSignInPage() {
  return (
    <main className="syncvas-auth-page">
      <TeacherAuthVisual />

      <section className="syncvas-auth-panel" aria-labelledby="teacher-sign-in-title">
        <div className="syncvas-auth-panel-inner">
          <Link href="/" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm syncvas-auth-home">
            <span aria-hidden="true">←</span>
            Home
          </Link>
          <TeacherSignInCard />
        </div>
      </section>
    </main>
  );
}
