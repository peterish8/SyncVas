"use client";

import { motion, useReducedMotion } from "motion/react";

import { CapabilityCard } from "@/components/landing/capability-card";
import { staggerParent, viewportOnce } from "@/lib/landing-motion";

const capabilities = [
  ["01", "Teach in motion", "Write naturally. The room receives the lesson as it happens."],
  ["02", "Look back freely", "Students move through the board at their pace, then return in one tap."],
  ["03", "Ask without pressure", "Anonymous doubts make space for the questions that usually stay quiet."],
] as const;

export function LandingCapabilities() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="origin-capabilities"
      aria-label="Syncvas capabilities"
      variants={staggerParent}
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={viewportOnce}
    >
      {capabilities.map(([number, title, copy], index) => (
        <CapabilityCard key={title} index={index} number={number} title={title} copy={copy} />
      ))}
    </motion.section>
  );
}
