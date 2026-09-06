"use client";

import { useEffect } from "react";

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

  return (
    <button
      type="button"
      className="syncvas-theme-toggle"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span aria-hidden="true">{isDark ? "☼" : "◐"}</span>
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

export { readTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY };
