import type { Metadata } from "next";

import { SeoPage } from "@/components/seo/seo-page";

const title = "What is a live classroom whiteboard? A practical guide";
const description =
  "Learn how a live classroom whiteboard works, what teachers need for writing-first lessons, and how students can follow or explore a shared board.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides/live-classroom-whiteboard" },
  openGraph: { title, description, url: "/guides/live-classroom-whiteboard", type: "article" },
};

export default function LiveClassroomWhiteboardGuide() {
  return (
    <SeoPage path="/guides/live-classroom-whiteboard" eyebrow="Guide · September 2026" title={title} intro={description}>
      <section aria-labelledby="definition">
        <h2 id="definition">A live classroom whiteboard connects explanation and attention.</h2>
        <p>
          Unlike a static slide deck, a live classroom whiteboard records the teacher&apos;s thinking as it happens. The teacher writes, diagrams, solves, and revises in one shared space. Students see the current board through a browser and can move around the canvas without taking control of the lesson. A good system makes joining quick, keeps the writing responsive, and preserves the finished board after class.
        </p>
      </section>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works">How does a live whiteboard work?</h2>
        <p>
          The teacher&apos;s browser owns the editable board. A realtime connection distributes board changes to viewers, while durable classroom data stores the room lifecycle and final artifact. Each student keeps their own camera position, so one person can zoom into a proof without moving everyone else. Follow mode is a separate choice that mirrors the teacher&apos;s viewport only while it is enabled.
        </p>
      </section>

      <section aria-labelledby="class-checklist">
        <h2 id="class-checklist">A practical classroom checklist</h2>
        <ol>
          <li>Prepare a short lesson title and open the room.</li>
          <li>Show the QR code or read the short join code aloud.</li>
          <li>Write in short, visible steps and pause for questions.</li>
          <li>Invite students to use Follow Teacher when they want the live camera.</li>
          <li>Leave time for anonymous doubts and resolve them in the queue.</li>
          <li>End the room only after the final board state is saved.</li>
        </ol>
      </section>

      <section aria-labelledby="questions">
        <h2 id="questions">Common questions</h2>
        <details><summary>Do students need an account?</summary><p>No. Students join with the teacher&apos;s QR code or six-character code.</p></details>
        <details><summary>Can students edit the shared board?</summary><p>No. The teacher is the only board editor; students can pan and zoom their own view.</p></details>
        <details><summary>Can a student stop following the teacher?</summary><p>Yes. Manual navigation exits follow mode locally, and Return to Teacher enables it again.</p></details>
      </section>
    </SeoPage>
  );
}
