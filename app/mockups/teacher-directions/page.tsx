import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "./teacher-mockups.module.css";

export const metadata: Metadata = {
  title: "Teacher scene directions",
  description: "A private visual study of alternate cinematic directions for the Syncvas teacher scene.",
  robots: { index: false, follow: false },
};

function DirectionLabel({ number, title, descriptor }: { number: string; title: string; descriptor: string }) {
  return (
    <div className={styles.directionLabel}>
      <span className={styles.directionNumber}>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{descriptor}</p>
      </div>
    </div>
  );
}

function TeacherCopy({ eyebrow, title, accent, note, className = "" }: { eyebrow: string; title: string; accent: string; note: string; className?: string }) {
  return (
    <div className={`${styles.copy} ${className}`}>
      <span className={styles.copyEyebrow}>{eyebrow}</span>
      <h3>
        {title} <em>{accent}</em>
      </h3>
      <p>{note}</p>
      <span className={styles.copyCta}>Open a teacher room <b>↗</b></span>
    </div>
  );
}

export default function TeacherDirectionsPage() {
  // A private design study. It stays available to `next dev` but must not be a
  // reachable route on the public site.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/#for-teachers">← Back to the production section</Link>
        <p className={styles.kicker}>SYNCVAS / TEACHER SCENE STUDY</p>
        <h1>Four ways to make the lesson feel like a film.</h1>
        <p className={styles.intro}>
          The current board card is useful, but it reads like a component. These studies turn the same teacher-led promise into a point of view. Pick the frame that feels most like Syncvas.
        </p>
        <p className={styles.recommendation}><span>Studio lean</span> 01 / Orbit Desk — strongest balance of classroom clarity and cinematic tension.</p>
      </header>

      <section className={styles.grid} aria-label="Teacher scene directions">
        <article className={`${styles.option} ${styles.orbit}`}>
          <DirectionLabel number="01" title="Orbit desk" descriptor="The lesson as a living orbit around the teacher." />
          <div className={styles.orbitScene}>
            <div className={styles.orbitHalo} />
            <div className={styles.orbitRing} />
            <div className={styles.orbitBoard}>
              <span>Graph traversal</span>
              <strong>dfs(root)</strong>
              <i />
              <small>stack → [A, C, F]</small>
            </div>
            <div className={styles.orbitSatellite}><span>STUDENT VIEW</span><b>dfs(root)</b><small>Following teacher</small></div>
            <span className={styles.orbitSignal}>4 asked this <b>↗</b></span>
            <TeacherCopy eyebrow="The teacher stays in control" title="One pen. Every" accent="mind." note="The board holds the room together while every student finds their own way through it." />
          </div>
        </article>

        <article className={`${styles.option} ${styles.film}`}>
          <DirectionLabel number="02" title="Film still" descriptor="A quiet hero frame with the lesson caught mid-take." />
          <div className={styles.filmScene}>
            <div className={styles.filmTopBar}><span>LIVE TAKE 04</span><span>CLASS 09 · ALGORITHMS</span></div>
            <div className={styles.filmLight} />
            <div className={styles.filmBoard}>
              <span>Tracing depth-first search</span>
              <strong>function dfs(node) {'{'}</strong>
              <b>if (!node) return;</b>
              <small>Board v.24&nbsp;&nbsp; • &nbsp;&nbsp;Following teacher</small>
            </div>
            <TeacherCopy className={styles.filmCopy} eyebrow="A live classroom board" title="The lesson has" accent="room to move." note="A wide frame that lets a teacher's thought breathe before the next mark lands." />
            <div className={styles.filmBottomBar} />
          </div>
        </article>

        <article className={`${styles.option} ${styles.editorial}`}>
          <DirectionLabel number="03" title="Editorial index" descriptor="A tactile magazine spread for ideas that deserve a margin." />
          <div className={styles.editorialScene}>
            <div className={styles.editorialIndex}>03</div>
            <div className={styles.editorialRail}><span>TEACH / EXPLORE / RETURN</span><i /></div>
            <div className={styles.editorialPaper}>
              <span>ONE SHARED LESSON</span>
              <strong>dfs(root)</strong>
              <i />
              <small>stack → [A, C, F]</small>
              <b>↗</b>
            </div>
            <TeacherCopy className={styles.editorialCopy} eyebrow="01 / The shared lesson" title="Make space for" accent="thinking." note="The board becomes an editorial object: clear, considered, and unmistakably teacher-led." />
          </div>
        </article>

        <article className={`${styles.option} ${styles.signal}`}>
          <DirectionLabel number="04" title="Signal room" descriptor="A calm mission-control view of one room, many minds." />
          <div className={styles.signalScene}>
            <div className={styles.signalTopline}><span className={styles.signalDot} /> SYNCVAS LIVE <span>CS-09</span></div>
            <div className={styles.signalWindow}>
              <div className={styles.signalToolbar}><span>TEACHER BOARD</span><b>LIVE</b><small>28 students</small></div>
              <div className={styles.signalCanvas}><span>function dfs(node) {'{'}</span><b>if (!node) return;</b><i className={styles.signalCursor} /></div>
              <div className={styles.signalSide}><small>FOLLOW MODE</small><b>ON</b><span>Room code</span><strong>CS-09</strong></div>
            </div>
            <div className={styles.signalTrace} />
            <TeacherCopy className={styles.signalCopy} eyebrow="The room is listening" title="One teacher." accent="Every mind." note="A control-room composition that makes the shared lesson feel active, precise, and alive." />
          </div>
        </article>
      </section>

      <footer className={styles.footerNote}>
        <span>Choose one direction</span>
        <p>This is a review-only mockup. The selected direction will be translated into the production teacher scene after you pick it.</p>
      </footer>
    </main>
  );
}
