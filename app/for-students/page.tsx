import type { Metadata } from "next";
import Link from "next/link";

import { SeoPage } from "@/components/seo/seo-page";

const title = "Student-friendly live classroom board";
const description =
  "Join a Syncvas classroom without an account, read the teacher's board, explore it locally, follow the lesson when needed, and ask anonymous doubts.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/for-students" },
  openGraph: { title, description, url: "/for-students", type: "article" },
};

export default function ForStudentsPage() {
  return (
    <SeoPage path="/for-students" eyebrow="For students" title={title} intro={description}>
      <section aria-labelledby="student-join">
        <h2 id="student-join">Join the lesson with a short code.</h2>
        <p>
          Your teacher shares a six-character room code or a QR code. Enter it on the Syncvas join page from your phone, tablet, or laptop and the current board opens in a read-only view. There is no student account to create and no name shown to the teacher by default.
        </p>
      </section>

      <section aria-labelledby="student-control">
        <h2 id="student-control">Follow the teacher or study at your pace</h2>
        <ul>
          <li><b>Read-only by design.</b> You can learn from the shared board without accidentally changing the teacher&apos;s work.</li>
          <li><b>Free roam.</b> Pan and zoom locally to inspect a diagram or an earlier line of working.</li>
          <li><b>Follow Teacher.</b> Mirror the teacher&apos;s viewport when you want to stay with the live explanation.</li>
          <li><b>Return to Teacher.</b> Re-enable follow mode instantly after exploring.</li>
        </ul>
      </section>

      <section aria-labelledby="student-doubts">
        <h2 id="student-doubts">Ask a question without interrupting</h2>
        <p>
          The anonymous doubt composer gives you a quiet way to flag what is unclear. Basic rate limits and moderation protect the classroom, while the teacher sees useful questions without exposing your identity in the queue.
        </p>
        <div className="origin-seo-callout"><strong>Have a room code?</strong><span>Join directly and open the live board.</span><Link href="/join">Join a class <span aria-hidden="true">↗</span></Link></div>
      </section>
    </SeoPage>
  );
}
