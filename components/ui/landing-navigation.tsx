"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { SyncvasLogo } from "@/components/ui/syncvas-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { landingSpring } from "@/lib/landing-motion";

export function LandingNavigation() {
  const [compact, setCompact] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let frame = 0;
    const updateNavigation = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setCompact(window.scrollY > 24));
    };
    updateNavigation();
    window.addEventListener("scroll", updateNavigation, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateNavigation);
    };
  }, []);

  return (
    <motion.nav
      className={`origin-nav${compact ? " is-compact" : ""}`}
      aria-label="Primary navigation"
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { ...landingSpring, layout: { duration: 0.28 } }}
    >
      <div className="origin-nav-glass" aria-hidden="true" />
      <Link className="origin-mark" href="/" aria-label="Syncvas home">
        <SyncvasLogo />
      </Link>
      <div className="origin-links">
        <a href="#how-it-works">How it works</a>
        <a href="#experience">Experience</a>
        <a href="#for-teachers">For teachers</a>
      </div>
      <div className="origin-nav-controls">
        <ThemeToggle />
        <motion.div whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
          <Link className="origin-nav-action origin-button-join" href="/join">
            Join a class <span aria-hidden="true">↗</span>
          </Link>
        </motion.div>
      </div>
    </motion.nav>
  );
}
