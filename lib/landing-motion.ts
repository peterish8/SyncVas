import type { Transition, Variants } from "motion/react";

/** Shared landing motion tokens — keep transforms/opacity only. */
export const landingEase = [0.22, 0.85, 0.25, 1] as const;

export const landingSpring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
  mass: 0.85,
};

export const landingTween = (duration = 0.55): Transition => ({
  duration,
  ease: landingEase,
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: landingTween(0.55),
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: landingTween(0.45),
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 18 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: landingTween(0.65),
  },
};

export const staggerParent: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.06,
    },
  },
};

export const viewportOnce = {
  once: true,
  amount: 0.28,
  margin: "0px 0px -8% 0px",
} as const;
