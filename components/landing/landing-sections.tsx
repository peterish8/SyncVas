"use client";

import { motion, useReducedMotion } from "motion/react";

import { LandingButtonMotion } from "@/components/landing/landing-hero";
import { TeacherRibbons } from "@/components/landing/teacher-ribbons";
import { fadeIn, fadeUp, scaleIn, staggerParent, viewportOnce } from "@/lib/landing-motion";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export function LandingHowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="how-it-works"
      className="origin-seo-answer"
      aria-labelledby="syncvas-definition"
      variants={staggerParent}
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={viewportOnce}
    >
      <motion.div className="origin-seo-story" variants={fadeUp}>
        <p className="origin-section-index">1. The shared lesson</p>
        <p className="origin-eyebrow">What is Syncvas?</p>
        <h2 id="syncvas-definition">Live classroom whiteboarding for teachers and students.</h2>
        <p>
          One teacher writes live. Every student can follow the explanation or explore the board at
          their own pace—without changing the lesson for anyone else.
        </p>
      </motion.div>
      <motion.aside className="origin-seo-flow" aria-label="How a Syncvas classroom works" variants={fadeUp}>
        <p>One room. Two viewpoints.</p>
        <ol>
          <li>
            <b>01</b>
            <span>Open a room</span>
            <small>The teacher starts a focused live board.</small>
          </li>
          <li>
            <b>02</b>
            <span>Share the join code</span>
            <small>Students scan the QR code or enter six characters.</small>
          </li>
          <li>
            <b>03</b>
            <span>Teach, explore, return</span>
            <small>Everyone sees the same lesson with local control.</small>
          </li>
        </ol>
        <div className="origin-seo-flow-art" aria-hidden="true">
          <span>Teacher</span>
          <i />
          <span>Shared board</span>
          <i />
          <span>Your view</span>
        </div>
      </motion.aside>
      <motion.nav className="origin-answer-links" aria-label="Syncvas learning pages" variants={fadeIn}>
        <a href="/for-teachers">
          Teacher workflow <span aria-hidden="true">↗</span>
        </a>
        <a href="/for-students">
          Student experience <span aria-hidden="true">↗</span>
        </a>
        <a href="/guides/live-classroom-whiteboard">
          Live whiteboard guide <span aria-hidden="true">↗</span>
        </a>
      </motion.nav>
    </motion.section>
  );
}

export function LandingIntro() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="experience"
      className="origin-intro"
      variants={staggerParent}
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={viewportOnce}
    >
      <motion.p className="origin-eyebrow" variants={fadeUp}>
        A board is not a broadcast
      </motion.p>
      <motion.h2 variants={fadeUp}>
        It is the place
        <br />
        where the <em>idea changes.</em>
      </motion.h2>
      <motion.p className="origin-intro-copy" variants={fadeUp}>
        Syncvas keeps the teacher&apos;s explanation live, while leaving every student enough room to
        make sense of it.
      </motion.p>
    </motion.section>
  );
}

export function LandingTeacher() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="for-teachers"
      className="origin-teacher"
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={viewportOnce}
      variants={staggerParent}
    >
      <motion.div className="origin-teacher-art" aria-hidden="true" variants={scaleIn}>
        <TeacherRibbons />
        <div className="origin-teacher-ribbons-shade" />
      </motion.div>

      <motion.div className="origin-teacher-copy" variants={fadeUp}>
        <svg
          className="origin-teacher-mind-mark"
          viewBox="0 0 24 24"
          role="presentation"
          aria-hidden="true"
        >
          <path
            className="origin-teacher-mind-outline"
            d="M12 18V5"
          />
          <path
            className="origin-teacher-mind-path"
            d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5M17.997 5.125a4 4 0 0 1 2.526 5.77M18 18a4 4 0 0 0 2-7.464M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517M6 18a4 4 0 0 1-2-7.464M6.003 5.125a4 4 0 0 0-2.526 5.77"
          />
        </svg>
        <p className="origin-eyebrow">The teacher stays in control</p>
        <h2>
          One pen.
          <br />
          Every <em>mind</em>
          <motion.svg
            className="origin-heading-pen"
            viewBox="0 0 24 24"
            aria-hidden="true"
            animate={reduceMotion ? undefined : { rotate: [-12, 10, -12] }}
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 5.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
            />
          </motion.svg>
          .
        </h2>
        <LandingButtonMotion className="origin-button origin-button-light" href="/teacher">
          Open a teacher room <Arrow />
        </LandingButtonMotion>
        <p>
          Students cannot alter the board. They can follow, wander, ask, and return—without taking the
          lesson off course.
        </p>
      </motion.div>
    </motion.section>
  );
}
