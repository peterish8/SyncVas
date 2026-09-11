"use client";

import { useEffect, useId } from "react";

import { notifyStoredValue, useStoredValue } from "@/lib/client-store";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "syncvas-theme";
const THEME_CHANGE_EVENT = "syncvas-theme-change";

/** Module scope: `useStoredValue` needs a stable snapshot parser. */
function parseTheme(raw: string | null): Theme {
  return raw === "dark" ? "dark" : "light";
}

function readTheme(): Theme {
  return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  notifyStoredValue();
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}

export function ThemeToggle() {
  // localStorage is an external system: subscribe to it instead of copying it
  // into state from an effect. Server/hydration render is always "light".
  const theme = useStoredValue({
    storage: "local",
    key: THEME_STORAGE_KEY,
    parse: parseTheme,
    serverValue: "light" as Theme,
  });

  // Writing the document attribute IS the external-system update an effect is for.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    applyTheme(theme === "light" ? "dark" : "light");
  };

  const isDark = theme === "dark";
  // Two toggles can share a page (nav + compact nav), and duplicate mask ids
  // would make one of them render the wrong shape.
  const maskId = `syncvas-theme-cut-${useId()}`;

  return (
    <button
      type="button"
      className="syncvas-theme-toggle"
      data-mode={isDark ? "dark" : "light"}
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      data-tooltip={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Sun and moon are one shape: the disc grows and a second circle slides
          in to bite a crescent out of it, while the rays retract. */}
      <svg className="syncvas-theme-icon" viewBox="0 0 24 24" aria-hidden="true">
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="#fff" />
          <circle className="syncvas-theme-cut" cx="26" cy="6" r="7" fill="#000" />
        </mask>
        <circle
          className="syncvas-theme-disc"
          cx="12"
          cy="12"
          r="5"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
        <g
          className="syncvas-theme-rays"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        >
          <line x1="12" y1="1.6" x2="12" y2="3.9" />
          <line x1="12" y1="20.1" x2="12" y2="22.4" />
          <line x1="1.6" y1="12" x2="3.9" y2="12" />
          <line x1="20.1" y1="12" x2="22.4" y2="12" />
          <line x1="4.6" y1="4.6" x2="6.3" y2="6.3" />
          <line x1="17.7" y1="17.7" x2="19.4" y2="19.4" />
          <line x1="4.6" y1="19.4" x2="6.3" y2="17.7" />
          <line x1="17.7" y1="6.3" x2="19.4" y2="4.6" />
        </g>
      </svg>
    </button>
  );
}

export { readTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY };
