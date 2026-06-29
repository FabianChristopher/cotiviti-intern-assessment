/*
 * components/theme-toggle.tsx
 * -----------------------------------------------------------------------
 * A single button that switches the app between light and dark mode by
 * toggling a `data-theme` attribute on the root <html> element. Every
 * color in the app is defined in app/globals.css as a CSS variable keyed
 * off that attribute (see `html[data-theme="light"]` / `html[data-theme=
 * "dark"]` there) -- so this component's only job is deciding which
 * value that attribute should have, and persisting the choice.
 *
 * AVOIDING A FLASH OF THE WRONG THEME: the very first time this
 * component renders, it reads the already-applied `data-theme` value
 * from the DOM (set synchronously by an inline script in app/layout.tsx
 * before React even hydrates) rather than defaulting to a hardcoded
 * value -- this prevents a visible flash from light to dark (or vice
 * versa) immediately after page load.
 * -----------------------------------------------------------------------
 */

"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import styles from "./theme-toggle.module.css";

type Theme = "light" | "dark";

/** Reads the theme that's already applied to <html> (set by the inline
 *  script in app/layout.tsx). Falls back to "light" only in the
 *  extremely unlikely case the attribute is somehow missing -- the
 *  inline script should always have set it by the time this runs. */
function getCurrentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  // We deliberately default to "light" here and correct it in the
  // effect below, rather than reading `document` directly in the
  // useState initializer. This component is server-rendered first (no
  // `document` exists yet) and then hydrated on the client -- reading
  // real DOM state during the initial render would make the
  // server-rendered markup and the client's first render disagree,
  // which React flags as a hydration mismatch. Doing it in an effect
  // instead means: render the safe default once, then immediately
  // correct it from the real DOM state on mount, which is the standard
  // pattern for any "read external truth that doesn't exist during
  // SSR" case (the same approach used by libraries like next-themes).
  const [theme, setTheme] = useState<Theme>("light");

  // This one-time, on-mount correction from the SSR-safe "light" default
  // to whatever theme is actually already applied to <html> is exactly
  // the documented exception to the lint rule below: a read of external
  // (DOM) state that is genuinely unavailable until after mount, not a
  // general state-sync anti-pattern. See the comment above `theme`'s
  // declaration for the full reasoning.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getCurrentTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

/* Small hand-written inline SVG icons -- kept dependency-free rather
   than pulling in an icon library for two glyphs (see God Rule 3 on
   lean, deliberate dependencies). */

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="12" y1="2.5" x2="12" y2="4.5" />
        <line x1="12" y1="19.5" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="4.5" y2="12" />
        <line x1="19.5" y1="12" x2="21.5" y2="12" />
        <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
        <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
        <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
        <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
      </g>
    </svg>
  );
}
