"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import React, { useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ButtonStatus = "idle" | "loading" | "success";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onError"> {
  className?: string;
  children: React.ReactNode;
  /** How long the success check remains visible before returning to idle. */
  successDuration?: number;
  /** Optional callback for rendering the request failure in the parent. */
  onError?: (error: unknown) => void;
}

/**
 * A small async-aware button for mutations and other actions with a noticeable wait.
 * Navigation, toggles, and other immediate controls should remain ordinary buttons.
 */
export function Button({
  className,
  children,
  onClick,
  onError,
  successDuration = 1400,
  disabled,
  type = "button",
  onDrag,
  onDragStart,
  onDragEnd,
  onAnimationStart,
  onAnimationEnd,
  ...buttonProps
}: ButtonProps) {
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const running = useRef(false);
  const reduceMotion = useReducedMotion();

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (running.current || disabled) return;

    running.current = true;
    setStatus("loading");

    try {
      const result = onClick?.(event) as unknown;
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        await result;
      }

      setStatus("success");
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, successDuration)));
      setStatus("idle");
    } catch (error) {
      setStatus("idle");
      onError?.(error);
    } finally {
      running.current = false;
    }
  };

  const statusLabel = status === "loading" ? "Loading" : status === "success" ? "Complete" : null;

  // These native handlers conflict with Motion's animation callback types, so the
  // primitive intentionally owns them. Keep the destructured values explicit for
  // callers migrating from a native button without leaking incompatible props.
  void [onDrag, onDragStart, onDragEnd, onAnimationStart, onAnimationEnd];

  return (
    <motion.button
      type={type}
      layout
      disabled={disabled || status === "loading"}
      aria-busy={status === "loading"}
      className={cn(
        "syncvas-btn syncvas-btn-primary inline-flex min-w-[120px] items-center justify-center gap-2 rounded-full",
        className,
      )}
      {...buttonProps}
      onClick={handleClick}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
    >
      <motion.span layout className="inline-flex items-center gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {status !== "idle" ? (
            <motion.span
              key={status}
              aria-hidden="true"
              initial={reduceMotion ? undefined : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.7 }}
              transition={{ duration: reduceMotion ? 0 : 0.16 }}
              className="inline-flex"
            >
              {status === "loading" ? <Loader reduceMotion={reduceMotion} /> : <CheckIcon />}
            </motion.span>
          ) : null}
        </AnimatePresence>
        <motion.span layout>{children}</motion.span>
      </motion.span>
      <span className="sr-only" aria-live="polite">
        {statusLabel}
      </span>
    </motion.button>
  );
}

/** Named alias for call sites that prefer the component's intent to be explicit. */
export const StatefulButton = Button;

function Loader({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-4", !reduceMotion && "animate-spin")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
