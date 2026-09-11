/**
 * Post-class notes for students.
 *
 * Reachable without an account: a student who attended keeps the session link
 * and gets the notes from it. The Convex query gates on session status, so this
 * route shows nothing until the class has actually ended.
 */

import Link from "next/link";

import { ClassSummary } from "@/components/summary/class-summary";
import { AppShell } from "@/components/ui/app-shell";

type Props = { params: Promise<{ sessionId: string }> };

export default async function StudentNotesPage({ params }: Props) {
  const { sessionId } = await params;

  return (
    <AppShell
      title="Class notes"
      trailing={
        <Link href="/join" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm">
          Join a class
        </Link>
      }
      contentClassName="max-w-3xl"
    >
      <div className="px-6 py-7 sm:px-8 sm:py-9">
        <ClassSummary sessionId={sessionId} />
      </div>
    </AppShell>
  );
}
