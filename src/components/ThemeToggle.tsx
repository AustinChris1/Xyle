"use client";

import { useCallback, useSyncExternalStore } from "react";
import { motion } from "framer-motion";

type Theme = "light" | "dark";

const STORAGE_KEY = "signal-arena-theme";
const EVENT = "signal-arena-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/**
 * The knob and icons are driven by CSS off `html[data-theme]`, so the control
 * is already in the right position on first paint. React only tracks the
 * theme to keep the accessible label truthful.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    readTheme,
    () => "dark"
  );
  const isDark = theme === "dark";

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked, the choice still applies for this session
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="theme-toggle"
    >
      <span className="theme-knob">
        <svg
          className="theme-icon theme-icon-moon"
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          className="theme-icon theme-icon-sun"
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
    </motion.button>
  );
}
