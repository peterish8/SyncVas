import type { Metadata } from "next";
import Link from "next/link";

import { SeoPage } from "@/components/seo/seo-page";

const title = "Live classroom whiteboard for teachers";
const description =
  "Use Syncvas to teach live with a stylus-friendly whiteboard, QR-code joining, read-only student views, anonymous doubts, and a saved final board.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/for-teachers" },
  openGraph: { title, description, url: "/for-teachers", type: "article" },
};

export default function ForTeachersPage() {
  return (
    <SeoPage path="/for-teachers" eyebrow="For teachers" title={title} intro={description}>
      <section aria-labelledby="teacher-control">
        <h2 id="teacher-control">Keep the lesson live and the teacher in control.</h2>
        <p>
          Syncvas is built for teachers who think on the board. Start a classroom, write naturally with a stylus or mouse, and let every student see the same explanation as it develops. The teacher is the single editor, which keeps a worked example coherent while students still have room to inspect, zoom, and revisit ideas.
        </p>
      </section>

      <section aria-labelledby="teacher-workflow">
        <h2 id="teacher-workflow">A simple workflow for a live lesson</h2>
        <ol>
          <li><b>Open a room.</b> Give the class a clear title and start the live board.</li>
          <li><b>Share the code or QR code.</b> Students join from a modern browser without creating an account.</li>
          <li><b>Write and explain.</b> Excalidraw provides freehand drawing, shapes, text, erasing, undo, redo, pan, and zoom.</li>
          <li><b>Notice confusion.</b> Students can send anonymous doubts while you keep teaching.</li>
          <li><b>End with a record.</b> Syncvas saves the final board so the class can be revisited or exported.</li>
        </ol>
      </section>

      <section aria-labelledby="teacher-use-cases">
        <h2 id="teacher-use-cases">Useful for writing-first teaching</h2>
        <p>
          The format works especially well for mathematics proofs, science diagrams, language lessons, tutoring, office hours, and any session where the explanation is clearer when it is written step by step. Students can follow your viewport for the shared moment, then leave follow mode to study a detail at their own pace.
        </p>
        <div className="origin-seo-callout"><strong>Start with the board.</strong><span>Open a local teacher room and test the classroom flow.</span><Link href="/teacher">Open teacher board <span aria-hidden="true">↗</span></Link></div>
      </section>
    </SeoPage>
  );
}
