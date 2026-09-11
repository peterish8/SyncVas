"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { BoardPreview } from "@/components/landing/board-preview";
import { fadeUp, landingSpring, landingTween, scaleIn, staggerParent } from "@/lib/landing-motion";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export function LandingHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="origin-hero" aria-labelledby="origin-title">
      <motion.div
        className="origin-hero-copy"
        variants={staggerParent}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
      >
        <motion.p variants={fadeUp}>
          <i /> One live classroom, held in one place
        </motion.p>
        <motion.h1 id="origin-title" variants={fadeUp}>
          The lesson
          <br />
          has <em>room</em> to move.
        </motion.h1>
        <motion.div className="origin-hero-cta" variants={fadeUp}>
          <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
            <Link className="origin-button origin-button-dark" href="/teacher">
              Start teaching <Arrow />
            </Link>
          </motion.div>
          <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
            <Link className="origin-button origin-button-join" href="/join">
              Join a class <Arrow />
            </Link>
          </motion.div>
          <span>No student accounts required</span>
        </motion.div>
      </motion.div>

      <motion.div
        className="origin-stage"
        aria-label="A live Syncvas classroom board"
        variants={scaleIn}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        transition={landingTween(0.7)}
      >
        <BoardPreview />
      </motion.div>
    </section>
  );
}

export function LandingButtonMotion({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={landingSpring}
      style={{ display: "inline-flex" }}
    >
      <Link className={className} href={href}>
        {children}
      </Link>
    </motion.div>
  );
}
