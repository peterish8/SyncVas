import Link from "next/link";
import type { Metadata } from "next";

import { SiteStructuredData } from "@/components/seo/site-structured-data";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Live classroom whiteboard for teachers and students",
  description:
    "Syncvas is a live classroom whiteboard for stylus-led teaching. Share a room by QR code, let students follow or explore locally, and collect anonymous doubts.",
  alternates: { canonical: "/" },
};

const capabilities = [
  ["01", "Teach in motion", "Write naturally. The room receives the lesson as it happens."],
  ["02", "Look back freely", "Students move through the board at their pace, then return in one tap."],
  ["03", "Ask without pressure", "Anonymous doubts make space for the questions that usually stay quiet."],
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function Home() {
  return (
    <main className="origin-landing">
      <SiteStructuredData />
      <nav className="origin-nav" aria-label="Primary navigation">
        <Link className="origin-mark" href="/" aria-label="Syncvas home">syncvas<span>.</span></Link>
        <div className="origin-links"><a href="#how-it-works">How it works</a><a href="#experience">Experience</a><a href="#for-teachers">For teachers</a></div>
        <div className="origin-nav-controls"><ThemeToggle /><Link className="origin-nav-action" href="/join">Join a class <Arrow /></Link></div>
      </nav>

      <section className="origin-hero" aria-labelledby="origin-title">
        <div className="origin-glow origin-glow-coral" /><div className="origin-glow origin-glow-blue" /><div className="origin-glow origin-glow-lime" />
        <div className="origin-hero-copy">
          <p><i /> A live classroom, held in one place</p>
          <h1 id="origin-title">The lesson<br />has <em>room</em> to move.</h1>
          <div className="origin-hero-cta"><Link className="origin-button origin-button-dark" href="/teacher">Start teaching <Arrow /></Link><span>No student accounts required</span></div>
        </div>

        <div className="origin-stage" aria-label="A live Syncvas classroom board">
          <div className="origin-device">
            <header><div className="origin-device-title"><i /> syncvas <span>Class 09 · Quadratics</span><b>LIVE</b></div><div className="origin-device-people"><span>28 students</span></div></header>
            <div className="origin-workspace">
              <aside aria-hidden="true"><span className="selected">✦</span><span>╱</span><span>T</span><span>□</span><span>⌁</span></aside>
              <div className="origin-canvas">
                <div className="origin-canvas-label">Completing the square</div>
                <div className="origin-equation">x<sup>2</sup> + 6x + 9 = 0</div>
                <div className="origin-underline origin-underline-coral" />
                <div className="origin-working">(x + 3)<sup>2</sup> = 0</div>
                <div className="origin-underline origin-underline-green" />
                <div className="origin-canvas-meta"><span>Board v.24</span><b><i /> Following teacher</b></div>
              </div>
              <div className="origin-session-rail"><small>LIVE ROOM</small><strong>28</strong><p>students listening</p><div><span>Follow mode</span><b>On</b></div><section><small>ROOM CODE</small><b>MAT-09</b></section></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="origin-seo-answer" aria-labelledby="syncvas-definition">
        <div>
          <p className="origin-eyebrow">What is Syncvas?</p>
          <h2 id="syncvas-definition">Live classroom whiteboarding for teachers and students.</h2>
          <p>
            Syncvas is a live classroom whiteboard for teachers who explain by writing. A teacher opens a room, writes with a stylus or mouse, and shares a six-character code or QR code. Students join from any modern browser without creating an account. The board updates in real time while each student keeps a local view: they can zoom into a worked example, pan back to an earlier step, follow the teacher&apos;s viewport, or return to it instantly. The teacher remains the single editor, so the lesson stays coherent even when a class is large. Students can also send anonymous doubts, helping teachers notice confusion without putting anyone on the spot. When the class ends, Syncvas preserves the final board for later access and export. It is designed for live mathematics, science, tutoring, and any lesson where thinking becomes clearer when it is written out.
          </p>
        </div>
        <ol aria-label="How a Syncvas classroom works">
          <li><b>01</b><span>Open a room</span><small>The teacher starts a focused live board.</small></li>
          <li><b>02</b><span>Share the join code</span><small>Students scan the QR code or enter six characters.</small></li>
          <li><b>03</b><span>Teach, explore, return</span><small>Everyone sees the same lesson with local control.</small></li>
        </ol>
        <nav className="origin-answer-links" aria-label="Syncvas learning pages">
          <a href="/for-teachers">Teacher workflow <span aria-hidden="true">↗</span></a>
          <a href="/for-students">Student experience <span aria-hidden="true">↗</span></a>
          <a href="/guides/live-classroom-whiteboard">Live whiteboard guide <span aria-hidden="true">↗</span></a>
        </nav>
      </section>

      <section id="experience" className="origin-intro">
        <p className="origin-eyebrow">A board is not a broadcast.</p>
        <h2>It is the place<br />where the <em>idea changes.</em></h2>
        <p className="origin-intro-copy">Syncvas keeps the teacher&apos;s explanation live, while leaving every student enough room to make sense of it.</p>
      </section>

      <section className="origin-capabilities" aria-label="Syncvas capabilities">
        {capabilities.map(([number, title, copy], index) => <article key={title} className={`origin-capability origin-capability-${index + 1}`}><span>{number}</span><h3>{title}</h3><p>{copy}</p><b aria-hidden="true">↗</b></article>)}
      </section>

      <section id="for-teachers" className="origin-teacher">
        <div className="origin-teacher-art" aria-hidden="true"><span className="origin-orbit origin-orbit-one" /><span className="origin-orbit origin-orbit-two" /><div>⌁<small>SYNC</small></div></div>
        <div className="origin-teacher-copy"><p className="origin-eyebrow">The teacher stays in control</p><h2>One pen.<br />Every <em>mind.</em></h2><p>Students cannot alter the board. They can follow, wander, ask, and return—without taking the lesson off course.</p><Link className="origin-button origin-button-light" href="/teacher">Open a teacher room <Arrow /></Link></div>
      </section>

      <footer className="origin-footer">
        <div><Link className="origin-mark" href="/">syncvas<span>.</span></Link><p>Live whiteboards for<br />the thinking classroom.</p></div>
        <div className="origin-footer-nav"><a href="#experience">Experience</a><a href="#for-teachers">Teachers</a><Link href="/join">Join a class</Link></div>
        <Link className="origin-button origin-button-dark" href="/join">Enter with a code <Arrow /></Link>
      </footer>
    </main>
  );
}
