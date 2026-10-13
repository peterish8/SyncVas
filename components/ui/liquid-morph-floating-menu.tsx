"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

export interface LiquidMenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface FloatingMenuProps {
  items?: LiquidMenuItem[];
  className?: string;
  /** When false, selecting an item leaves the menu open (showcase flip-through). */
  closeOnSelect?: boolean;
  /** Label on the trigger — same when open or closed. */
  triggerLabel?: string;
}

const DEFAULT_ITEMS: LiquidMenuItem[] = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Experience", href: "#experience" },
  { label: "Teachers", href: "#for-teachers" },
  { label: "Join", href: "/join" },
];

function MenuButton({
  label,
  href,
  onClick,
  isOpen,
  index,
  reduceMotion,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  isOpen: boolean;
  index: number;
  reduceMotion: boolean | null;
}) {
  const [hovered, setHovered] = useState(false);
  const animatingRef = useRef(false);
  const pendingLeaveRef = useRef(false);
  const chars = label.split("");
  const lockDuration = 30 * chars.length + 300;

  const handleEnter = useCallback(() => {
    if (reduceMotion) {
      setHovered(true);
      return;
    }
    pendingLeaveRef.current = false;
    if (hovered) return;
    setHovered(true);
    animatingRef.current = true;
    window.setTimeout(() => {
      animatingRef.current = false;
      if (pendingLeaveRef.current) {
        pendingLeaveRef.current = false;
        setHovered(false);
      }
    }, lockDuration);
  }, [hovered, lockDuration, reduceMotion]);

  const handleLeave = useCallback(() => {
    if (reduceMotion) {
      setHovered(false);
      return;
    }
    if (animatingRef.current) {
      pendingLeaveRef.current = true;
    } else {
      setHovered(false);
    }
  }, [reduceMotion]);

  const sharedClassName = "sv-liquid-menu-item";
  const style = {
    opacity: isOpen ? 1 : 0,
    transitionDelay: reduceMotion ? "0ms" : isOpen ? `${280 + 60 * index}ms` : "0ms",
  } as const;

  const body = (
    <>
      <span className="sv-liquid-menu-item-label">{label}</span>
      <span className="sv-liquid-menu-chars" aria-hidden="true">
        {chars.map((char, i) => (
          <span key={`${char}-${i}`} className="sv-liquid-menu-char">
            <span
              className="sv-liquid-menu-char-stack"
              style={{
                transitionDuration: reduceMotion ? "0ms" : hovered ? "800ms" : "0ms",
                transitionDelay: reduceMotion ? "0ms" : hovered ? `${30 * i}ms` : "0ms",
                transform: hovered ? "translateY(-50%)" : "translateY(0%)",
              }}
            >
              <span>{char === " " ? "\u00A0" : char}</span>
              <span>{char === " " ? "\u00A0" : char}</span>
            </span>
          </span>
        ))}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        className={sharedClassName}
        href={href}
        style={style}
        tabIndex={isOpen ? 0 : -1}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={onClick}
      >
        {body}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={sharedClassName}
      style={style}
      tabIndex={isOpen ? 0 : -1}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={onClick}
    >
      {body}
    </button>
  );
}

/** Centered SyncVas liquid menu — closed lime pill, open wide short bar. */
export default function FloatingMenu({
  items,
  className,
  closeOnSelect = true,
  triggerLabel = "Menu",
}: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const labelId = useId();
  const menuItems = items ?? DEFAULT_ITEMS;

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={["sv-liquid-menu", className].filter(Boolean).join(" ")}
      data-open={isOpen ? "true" : "false"}
      data-reduced={reduceMotion ? "true" : "false"}
    >
      <div
        className="sv-liquid-menu-shell"
        role="navigation"
        aria-labelledby={labelId}
        onClick={() => {
          if (!isOpen) setIsOpen(true);
        }}
      >
        <div className="sv-liquid-menu-bg" aria-hidden="true" />
        <div className="sv-liquid-menu-blob" aria-hidden="true" />

        <div className="sv-liquid-menu-items" aria-hidden={!isOpen}>
          {menuItems.map((item, index) => (
            <MenuButton
              key={item.label}
              label={item.label}
              href={item.href}
              isOpen={isOpen}
              index={index}
              reduceMotion={reduceMotion}
              onClick={() => {
                item.onClick?.();
                if (closeOnSelect) setIsOpen(false);
              }}
            />
          ))}
        </div>

        <button
          type="button"
          className="sv-liquid-menu-bar"
          id={labelId}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Close ${triggerLabel}` : `Open ${triggerLabel}`}
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen((open) => !open);
          }}
        >
          <span className="sv-liquid-menu-label">{triggerLabel}</span>
          <span className="sv-liquid-menu-burger" aria-hidden="true">
            <motion.span
              animate={{
                rotate: isOpen ? 45 : 0,
                y: isOpen ? 0 : -3,
              }}
              transition={{ duration: reduceMotion ? 0 : 0.4, ease }}
            />
            <motion.span
              animate={{
                rotate: isOpen ? -45 : 0,
                y: isOpen ? 0 : 3,
              }}
              transition={{ duration: reduceMotion ? 0 : 0.4, ease }}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
