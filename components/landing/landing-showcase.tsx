"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { FloatingDock, type FloatingDockItem } from "@/components/ui/floating-dock";
import { fadeUp, staggerParent, viewportOnce } from "@/lib/landing-motion";

/**
 * "Ways in" showcase.
 *
 * A floating dock of the product's seven jobs; hovering (or focusing) one
 * raises the matching screen above it. Every dock entry is a real link, so the
 * section still works as navigation when JavaScript or hover is unavailable —
 * the preview is an enhancement, not the only way to read the content.
 */

type Audience = "For teachers" | "For students" | "For everyone";

type UseCase = {
  title: string;
  href: string;
  audience: Audience;
  headline: string;
  copy: string;
  mock: "room" | "board" | "doubts" | "join" | "explore" | "follow" | "after";
  icon: React.ReactNode;
};

function Glyph({ d, fill }: { d: string; fill?: boolean }) {
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const USE_CASES: UseCase[] = [
  {
    title: "Open a room",
    href: "/teacher",
    audience: "For teachers",
    headline: "A room, ready in one click.",
    copy: "Name the class, get a six-character code, and the board is live. No scheduling, no invites, no seat licences.",
    mock: "room",
    icon: <Glyph d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" />,
  },
  {
    title: "Teach live",
    href: "/for-teachers",
    audience: "For teachers",
    headline: "One pen. Every mind.",
    copy: "You write; the room receives each stroke as it happens. Students can never alter the board, so the lesson stays yours.",
    mock: "board",
    icon: <Glyph d="M3 17l9.5-9.5 4 4L7 21H3zM14 5.5L16.5 3l4 4L18 9.5z" />,
  },
  {
    title: "Read the room",
    href: "/for-teachers",
    audience: "For teachers",
    headline: "The quiet questions, surfaced.",
    copy: "Doubts arrive anonymous, moderated, and ranked by how many students felt the same. Answer the one that unblocks the most people.",
    mock: "doubts",
    icon: <Glyph d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    title: "Join in seconds",
    href: "/join",
    audience: "For students",
    headline: "Scan, or type six characters.",
    copy: "No account, no install, no waiting room. Open the link and you are in the lesson already in progress.",
    mock: "join",
    icon: <Glyph d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8h3v3H8zM8 13h3v3H8zM13 8h3v3h-3z" />,
  },
  {
    title: "Explore freely",
    href: "/for-students",
    audience: "For students",
    headline: "Your view is yours.",
    copy: "Pan back to the step you missed and zoom into the detail. Nothing you do moves the board for anyone else in the room.",
    mock: "explore",
    icon: <Glyph d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />,
  },
  {
    title: "Snap back",
    href: "/guides/live-classroom-whiteboard",
    audience: "For everyone",
    headline: "One tap and you are back.",
    copy: "Follow Teacher returns your viewport to exactly what is being explained, so wandering never costs you the thread.",
    mock: "follow",
    icon: <Glyph d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />,
  },
  {
    title: "After class",
    href: "/for-students",
    audience: "For everyone",
    headline: "The lesson keeps its shape.",
    copy: "The board, the doubts, and an AI recap are saved together — so revision starts from what actually happened in the room.",
    mock: "after",
    icon: <Glyph d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 13h8M8 17h5" />,
  },
];

/** Small per-case illustration; deliberately flat so it stays readable at size. */
function Mock({ kind }: { kind: UseCase["mock"] }) {
  if (kind === "room") {
    return (
      <div className="sv-show-mock sv-show-mock-room">
        <span className="sv-show-mock-label">Class 09 · Algorithms</span>
        <strong className="sv-show-code">CS-09</strong>
        <span className="sv-show-mock-foot">
          <i />
          Live · 28 joined
        </span>
      </div>
    );
  }
  if (kind === "board") {
    return (
      <div className="sv-show-mock sv-show-mock-board">
        <span className="sv-show-stroke" style={{ width: "72%" }} />
        <span className="sv-show-stroke sv-show-stroke-accent" style={{ width: "48%" }} />
        <span className="sv-show-stroke" style={{ width: "60%" }} />
        <span className="sv-show-pen" />
      </div>
    );
  }
  if (kind === "doubts") {
    return (
      <div className="sv-show-mock sv-show-mock-list">
        <span className="sv-show-row is-top">
          Why visit C before B? <b>▲ 12</b>
        </span>
        <span className="sv-show-row">
          Is the stack LIFO here? <b>▲ 5</b>
        </span>
        <span className="sv-show-row">
          Can we redo the trace? <b>▲ 2</b>
        </span>
      </div>
    );
  }
  if (kind === "join") {
    return (
      <div className="sv-show-mock sv-show-mock-join">
        <span className="sv-show-qr" aria-hidden="true" />
        <span className="sv-show-slots">
          {["C", "S", "0", "9", "K", "M"].map((c, i) => (
            <i key={`${c}-${i}`}>{c}</i>
          ))}
        </span>
      </div>
    );
  }
  if (kind === "explore") {
    return (
      <div className="sv-show-mock sv-show-mock-views">
        <span className="sv-show-view">
          <b>Teacher</b>
          <i />
        </span>
        <span className="sv-show-view is-student">
          <b>Your view</b>
          <i />
        </span>
      </div>
    );
  }
  if (kind === "follow") {
    return (
      <div className="sv-show-mock sv-show-mock-follow">
        <span className="sv-show-follow-pill">
          <i />
          Following teacher
        </span>
        <span className="sv-show-mock-foot">viewport synced</span>
      </div>
    );
  }
  return (
    <div className="sv-show-mock sv-show-mock-list">
      <span className="sv-show-row is-top">Recap · 6 key moments</span>
      <span className="sv-show-row">Board snapshot saved</span>
      <span className="sv-show-row">3 doubts answered</span>
    </div>
  );
}

export function LandingShowcase() {
  const reduceMotion = useReducedMotion();
  const [activeTitle, setActiveTitle] = useState<string>(USE_CASES[0].title);
  const active = USE_CASES.find((u) => u.title === activeTitle) ?? USE_CASES[0];

  const items: FloatingDockItem[] = USE_CASES.map((u) => ({
    title: u.title,
    href: u.href,
    icon: <span className="sv-show-icon">{u.icon}</span>,
  }));

  return (
    <motion.section
      id="ways-in"
      className="sv-show"
      aria-label="Ways into a Syncvas room"
      variants={staggerParent}
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={viewportOnce}
    >
      <motion.div className="sv-show-head" variants={fadeUp}>
        <p className="origin-section-index">4. Ways in</p>
        <h2>One room. Seven ways to use it.</h2>
        <p className="sv-show-lede">
          Hover any tool below to see what it does for the person holding it.
        </p>
      </motion.div>

      <motion.div className="sv-show-stage" variants={fadeUp}>
        <AnimatePresence mode="wait">
          <motion.article
            key={active.title}
            className="sv-show-screen"
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.34, ease: [0.22, 0.75, 0.22, 1] }}
          >
            <div className="sv-show-screen-copy">
              <span className="sv-show-audience" data-audience={active.audience}>
                {active.audience}
              </span>
              <h3>{active.headline}</h3>
              <p>{active.copy}</p>
            </div>
            <Mock kind={active.mock} />
          </motion.article>
        </AnimatePresence>
      </motion.div>

      <motion.div className="sv-show-dock-wrap" variants={fadeUp}>
        <FloatingDock
          items={items}
          desktopClassName="sv-show-dock"
          mobileClassName="sv-show-dock-mobile"
          onActiveChange={(title) => {
            if (title) setActiveTitle(title);
          }}
        />
      </motion.div>
    </motion.section>
  );
}
