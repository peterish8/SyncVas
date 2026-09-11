"use client";

/**
 * Last-resort boundary: it replaces the root layout, so it cannot rely on the
 * app's stylesheet or providers being alive. Everything here is inline and
 * self-contained on purpose.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[syncvas] global error", { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f7f5f1",
          color: "#1c1a17",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.75rem", opacity: 0.6 }}>
            Syncvas
          </p>
          <h1 style={{ fontSize: "1.75rem", lineHeight: 1.2, margin: "0.5rem 0 0.75rem" }}>
            Syncvas could not load
          </h1>
          <p style={{ margin: "0 0 1.5rem", opacity: 0.75 }}>
            Something failed before the app could start. Your saved boards are unaffected.
          </p>
          <button
            onClick={reset}
            type="button"
            style={{
              border: "1px solid #1c1a17",
              background: "#1c1a17",
              color: "#f7f5f1",
              borderRadius: "0.6rem",
              padding: "0.65rem 1.4rem",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", opacity: 0.55 }}>
              Reference <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
