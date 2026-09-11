"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { SyncvasLogo } from "@/components/ui/syncvas-logo";
import { landingTween, viewportOnce } from "@/lib/landing-motion";

/**
 * The one site footer.
 *
 * The landing page and the SEO/guide pages previously carried separate footer
 * markup; the styling only ever tracked the landing structure, so the guide
 * pages rendered a stunted version of it. Both now render this.
 *
 * Section links are absolute (`/#experience`) rather than bare fragments, so
 * they resolve from a guide page as well as from the landing page itself.
 */
export function SiteFooter() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.footer
      className="origin-footer"
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={landingTween(0.6)}
    >
      <div className="origin-footer-shell">
        <div className="origin-footer-meta">
          <Link className="origin-mark" href="/" aria-label="Syncvas home">
            <SyncvasLogo />
          </Link>
          <p>Live whiteboards for the thinking classroom.</p>
        </div>
        <nav className="origin-footer-nav" aria-label="Footer navigation">
          <div>
            <span>Product</span>
            <Link href="/#experience">Experience</Link>
            <Link href="/#for-teachers">For teachers</Link>
          </div>
          <div>
            <span>Start</span>
            <Link href="/teacher">Open a room</Link>
            <Link href="/join">Join a class</Link>
          </div>
          <div>
            <span>Learn</span>
            <Link href="/guides/live-classroom-whiteboard">Whiteboard guide</Link>
            <Link href="/for-students">For students</Link>
          </div>
        </nav>
        <p className="origin-footer-note">Made for teaching that moves with the class.</p>
      </div>
      <p className="origin-footer-wordmark" aria-hidden="true">
        syncvas
      </p>
    </motion.footer>
  );
}
