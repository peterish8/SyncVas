/**
 * QR deep link for /join/[code] — same membership path as the typed join code.
 *
 * The QR is a compact trigger in the live-room chrome; the scannable artefact
 * lives in an overlay sized to be read from the back of a classroom, with an
 * optional fullscreen presentation.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

import { Modal } from "@/components/ui/modal";

function joinUrlForCode(joinCode: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/join/${encodeURIComponent(joinCode)}`;
}

type QrRender = { href: string; dataUrl: string | null; error: string | null };

/** Renders the QR image for a join URL, keyed so a code change never shows a stale code. */
function useQrDataUrl(href: string) {
  const [rendered, setRendered] = useState<QrRender | null>(null);
  const current = rendered && rendered.href === href ? rendered : null;

  useEffect(() => {
    if (!href) return;
    let cancelled = false;
    void QRCode.toDataURL(href, {
      errorCorrectionLevel: "M",
      margin: 1,
      // Rendered large so a projector or a phone across the room still resolves it.
      width: 720,
      color: { dark: "#171717", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setRendered({ href, dataUrl: url, error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setRendered({ href, dataUrl: null, error: "Could not render QR code." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [href]);

  return { dataUrl: current?.dataUrl ?? null, error: current?.error ?? null };
}

export type JoinQrProps = { joinCode: string };

/**
 * Compact trigger + overlay. This is the form used inside a live room.
 */
export function JoinQrButton({ joinCode }: JoinQrProps) {
  const [open, setOpen] = useState(false);
  const href = useMemo(() => (joinCode ? joinUrlForCode(joinCode) : ""), [joinCode]);
  const { dataUrl, error } = useQrDataUrl(href);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const node = stageRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void node.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setOpen(false);
  }, []);

  if (!joinCode) return null;

  return (
    <>
      <button
        type="button"
        className="syncvas-dock-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Show join QR code"
        onClick={() => setOpen(true)}
      >
        <QrGlyph />
        <span className="hidden sm:inline">Show QR</span>
      </button>

      <Modal open={open} onClose={close} title={`Join code ${joinCode}`} hideTitle>
        <div ref={stageRef} className="syncvas-qr-stage" data-fullscreen={isFullscreen || undefined}>
          <p className="syncvas-eyebrow">Scan to join this class</p>

          <div className="syncvas-qr-frame">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL produced by qrcode
              <img src={dataUrl} alt={`QR code that joins room ${joinCode}`} />
            ) : (
              <div className="grid aspect-square w-[clamp(12rem,34vmin,22rem)] place-items-center text-sm text-ink-muted">
                {error ?? "Generating QR…"}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <p className="syncvas-qr-code">{joinCode}</p>
            <p className="syncvas-qr-url">{href}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="syncvas-btn syncvas-btn-secondary" onClick={toggleFullscreen}>
              {isFullscreen ? "Exit fullscreen" : "Present fullscreen"}
            </button>
            <button type="button" className="syncvas-btn syncvas-btn-primary" onClick={close}>
              Done
            </button>
          </div>
        </div>

        <button
          type="button"
          className="syncvas-icon-btn syncvas-modal-close"
          onClick={close}
          aria-label="Close QR code"
        >
          <CloseGlyph />
        </button>
      </Modal>
    </>
  );
}

/**
 * Inline QR card. Kept for surfaces that legitimately show the code in flow.
 */
export function JoinQr({ joinCode }: JoinQrProps) {
  const href = useMemo(() => (joinCode ? joinUrlForCode(joinCode) : ""), [joinCode]);
  const { dataUrl, error } = useQrDataUrl(href);

  if (!joinCode) {
    return (
      <div className="rounded-card border border-dashed border-border bg-canvas p-4 text-center text-sm text-ink-muted">
        Start the room to show a join QR.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-canvas p-4">
      <p className="syncvas-eyebrow">Scan to join</p>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL produced by qrcode
        <img
          src={dataUrl}
          alt={`QR code to join room ${joinCode}`}
          width={180}
          height={180}
          className="size-[180px] rounded-control border border-border bg-white p-2"
        />
      ) : (
        <div className="grid size-[180px] place-items-center rounded-control border border-dashed border-border text-sm text-ink-muted">
          {error ?? "Generating QR…"}
        </div>
      )}
      <a href={href} className="break-all text-center text-xs text-ink-muted underline-offset-2 hover:underline">
        {href}
      </a>
    </div>
  );
}

function QrGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.6" />
      <rect x="11" y="3" width="6" height="6" rx="1.6" />
      <rect x="3" y="11" width="6" height="6" rx="1.6" />
      <path d="M11 11h2.6v2.6H11zM14.4 14.4H17V17h-2.6z" strokeLinejoin="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}
