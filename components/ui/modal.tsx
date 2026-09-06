/**
 * Accessible overlay primitive.
 *
 * Escape closes, focus is trapped while open and restored on close, the
 * backdrop is click-to-dismiss, and the page behind cannot scroll. Rendered
 * through a portal so a board ancestor with `overflow:hidden` or a transform
 * cannot clip it.
 */

"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  title: string;
  /** Visually hide the title but keep it for assistive tech. */
  hideTitle?: boolean;
  children: ReactNode;
  /** Extra classes on the dialog surface. */
  className?: string;
  /** Element the dialog is rendered into. Defaults to document.body. */
  container?: HTMLElement | null;
};

export function Modal({ open, onClose, title, hideTitle, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, close]);

  // `open` only turns true from a user gesture, so there is no server render
  // of the portal to mismatch against.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="syncvas-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`syncvas-modal${className ? ` ${className}` : ""}`}
      >
        {hideTitle ? null : (
          <h2 className="text-xl font-semibold tracking-[-0.03em]">{title}</h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
