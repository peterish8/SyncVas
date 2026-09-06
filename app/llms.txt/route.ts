import { NextResponse } from "next/server";

import { absoluteUrl } from "@/lib/site-url";

export function GET() {
  const body = `# Syncvas
> Syncvas is a live classroom whiteboard where teachers write naturally and students join by QR code or short code.

## Public pages
- [Home](${absoluteUrl("/")}): Product overview, classroom workflow, and teacher/student benefits.
- [Join a class](${absoluteUrl("/join")}): Enter a teacher's six-character classroom code.
- [For teachers](${absoluteUrl("/for-teachers")}): Teacher workflow, writing-first lessons, and classroom controls.
- [For students](${absoluteUrl("/for-students")}): Account-free joining, read-only viewing, local navigation, and anonymous doubts.
- [Live classroom whiteboard guide](${absoluteUrl("/guides/live-classroom-whiteboard")}): A practical explanation of live whiteboards and classroom use.

## Key facts
- A teacher is the only person who edits the shared board in the MVP.
- Students can join without creating an account.
- Students can pan and zoom independently or follow the teacher's viewport.
- Students can submit anonymous doubts with rate limiting and moderation.
- The board is preserved when a teacher ends a class.

## Product boundary
Teacher and student classroom URLs are session-specific and should not be indexed.
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
