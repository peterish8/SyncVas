"use client";

import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import { motion, useAnimationFrame, useReducedMotion } from "motion/react";

import { fadeUp } from "@/lib/landing-motion";

/**
 * Liquid capability field.
 *
 * Three things make this read as fluid rather than as a few moving circles:
 *
 *  1. The blobs are *drawn toward* the pointer, not pushed away, so the mass
 *     gathers where the cursor is.
 *  2. Each one follows at a different rate, so they smear apart on a fast move
 *     and pool back together on a slow one — the lag is the liquid.
 *  3. Each is stretched along its own direction of travel and squashed across
 *     it, at constant area, the way a droplet elongates when it is flung.
 *
 * Ambient drift uses two incommensurate sine pairs per blob, so the resting
 * motion never closes a loop and never stalls at a keyframe.
 */
type BlobSpec = {
  /** Rest position in normalized card space (-1..1). */
  home: [number, number];
  /** Width as a percentage of the card. */
  size: number;
  /** Angular speed (rad/s) for x and y. Deliberately non-harmonic. */
  drift: [number, number];
  phase: [number, number];
  /** Drift amplitude, percent of blob size. */
  amp: [number, number];
  /** Share of the pointer distance this blob closes (0..1). */
  pull: number;
  /** Approach rate — lower is heavier, and produces the trailing smear. */
  inertia: number;
  /** How strongly speed elongates the blob. */
  stretch: number;
  tint: string;
};

const BLOBS: BlobSpec[] = [
  {
    home: [-0.42, -0.34],
    size: 68,
    drift: [0.113, 0.079],
    phase: [0.0, 1.7],
    amp: [11, 9],
    pull: 0.92,
    inertia: 7.5,
    stretch: 0.5,
    tint: "var(--capability-blob-a)",
  },
  {
    home: [0.4, 0.36],
    size: 74,
    drift: [0.067, 0.101],
    phase: [2.3, 0.6],
    amp: [10, 12],
    pull: 0.84,
    inertia: 5,
    stretch: 0.62,
    tint: "var(--capability-blob-b)",
  },
  {
    home: [0.12, -0.22],
    size: 58,
    drift: [0.091, 0.058],
    phase: [4.1, 3.2],
    amp: [13, 10],
    pull: 0.76,
    inertia: 3.4,
    stretch: 0.74,
    tint: "var(--capability-blob-c)",
  },
  {
    home: [-0.3, 0.4],
    size: 62,
    drift: [0.049, 0.087],
    phase: [1.1, 5.0],
    amp: [12, 11],
    pull: 0.66,
    inertia: 2.3,
    stretch: 0.86,
    tint: "var(--capability-blob-a)",
  },
  {
    home: [0.28, 0.02],
    size: 52,
    drift: [0.077, 0.043],
    phase: [3.4, 2.1],
    amp: [14, 12],
    pull: 0.55,
    inertia: 1.6,
    stretch: 1,
    tint: "var(--capability-blob-b)",
  },
];

type CapabilityCardProps = {
  index: number;
  number: string;
  title: string;
  copy: string;
};

export function CapabilityCard({ index, number, title, copy }: CapabilityCardProps) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(false);

  const blobEls = useRef<Array<HTMLSpanElement | null>>([]);
  /** Pointer, card size and per-blob state — kept off the React render path. */
  const field = useRef({
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    presence: 0,
    cardW: 320,
    cardH: 240,
    blobs: BLOBS.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })),
  });

  useAnimationFrame((t, delta) => {
    if (reduceMotion) return;
    const f = field.current;
    if (!active && f.presence < 0.001) return;

    const dt = Math.min(delta, 64) / 1000;
    if (dt <= 0) return;
    const time = t / 1000;

    // Frame-rate independent smoothing: a dropped frame slows the approach
    // instead of snapping it.
    const approach = (rate: number) => 1 - Math.exp(-rate * dt);

    f.px += (f.tx - f.px) * approach(9);
    f.py += (f.ty - f.py) * approach(9);
    f.presence += ((active ? 1 : 0) - f.presence) * approach(3);

    const halfW = f.cardW / 2;
    const halfH = f.cardH / 2;

    for (let i = 0; i < BLOBS.length; i += 1) {
      const el = blobEls.current[i];
      if (!el) continue;
      const b = BLOBS[i];
      const o = f.blobs[i];

      // Ambient drift, always running so the mass is alive at rest.
      const driftX = Math.sin(time * b.drift[0] + b.phase[0]) * b.amp[0];
      const driftY = Math.cos(time * b.drift[1] + b.phase[1]) * b.amp[1];

      // Pointer attraction. Offsets are in percent of the blob's own box, so
      // the card-space delta has to be rescaled by the blob's pixel width.
      const blobPx = (b.size / 100) * f.cardW || 1;
      const pullX = (((f.px - b.home[0]) * halfW) / blobPx) * 100 * b.pull * f.presence;
      const pullY = (((f.py - b.home[1]) * halfH) / blobPx) * 100 * b.pull * f.presence;

      const targetX = driftX + pullX;
      const targetY = driftY + pullY;

      const prevX = o.x;
      const prevY = o.y;
      o.x += (targetX - o.x) * approach(b.inertia);
      o.y += (targetY - o.y) * approach(b.inertia);

      // Velocity in percent/second, smoothed so the stretch does not flicker.
      const vx = (o.x - prevX) / dt;
      const vy = (o.y - prevY) / dt;
      o.vx += (vx - o.vx) * approach(11);
      o.vy += (vy - o.vy) * approach(11);

      const speed = Math.hypot(o.vx, o.vy);
      // Saturates, so a fast flick stretches but never tears the shape apart.
      const mag = Math.min(speed / 260, 1) * b.stretch;
      const angle = speed > 0.5 ? (Math.atan2(o.vy, o.vx) * 180) / Math.PI : 0;
      const sx = 1 + mag * 0.42;
      const sy = 1 - mag * 0.26;

      const breathe = 0.95 + Math.sin(time * b.drift[0] * 1.31 + b.phase[1]) * 0.045;

      el.style.transform =
        `translate3d(${o.x.toFixed(2)}%, ${o.y.toFixed(2)}%, 0)` +
        ` rotate(${angle.toFixed(1)}deg)` +
        ` scale(${(sx * breathe).toFixed(3)}, ${(sy * breathe).toFixed(3)})`;
    }
  });

  const readCard = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const f = field.current;
    f.cardW = rect.width;
    f.cardH = rect.height;
    return rect;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = readCard(event.currentTarget);
    const f = field.current;
    // Normalized to -1..1 so the maths is resolution independent.
    f.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    f.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  };

  return (
    <motion.article
      className={`origin-capability origin-capability-${index + 1}`}
      variants={fadeUp}
      onPointerMove={handlePointerMove}
      onPointerEnter={(event) => {
        readCard(event.currentTarget);
        setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
      onFocus={(event) => {
        readCard(event.currentTarget);
        setActive(true);
      }}
      onBlur={() => setActive(false)}
      whileHover={reduceMotion ? undefined : { y: -8, transition: { type: "spring", stiffness: 210, damping: 26 } }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
    >
      {!reduceMotion && (
        <span className="origin-capability-liquid" aria-hidden="true">
          {BLOBS.map((b, i) => (
            <span
              key={`${b.tint}-${i}`}
              ref={(node) => {
                blobEls.current[i] = node;
              }}
              className="origin-capability-blob"
              style={{
                width: `${b.size}%`,
                left: `${50 + b.home[0] * 42 - b.size / 2}%`,
                top: `${50 + b.home[1] * 42 - b.size / 2}%`,
                background: `radial-gradient(circle at 45% 45%, ${b.tint} 0%, transparent 70%)`,
              }}
            />
          ))}
        </span>
      )}
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <b aria-hidden="true">↗</b>
    </motion.article>
  );
}
