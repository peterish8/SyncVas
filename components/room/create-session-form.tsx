/**
 * Teacher create live session — delegates to TeacherSessionControls in Phase 3 shell.
 */

"use client";

import { TeacherSessionControls } from "@/components/room/teacher-session-controls";

export function CreateSessionForm() {
  return <TeacherSessionControls />;
}
