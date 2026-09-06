/**
 * Student read-only classroom
 *
 * Phase 3: join only via signed room token after Convex join; no student name.
 */

import Link from "next/link";

import { StudentBoardShell } from "@/components/student/student-board-shell";
import { AppShell } from "@/components/ui/app-shell";

type Props = { params: Promise<{ sessionId: string }> };

export default async function StudentSessionPage({ params }: Props) {
  const { sessionId } = await params;

  return (
    <AppShell
      classroom
      title="Student board"
      trailing={
        <Link href="/join" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm">
          Join another
        </Link>
      }
    >
      <StudentBoardShell sessionId={sessionId} />
    </AppShell>
  );
}
