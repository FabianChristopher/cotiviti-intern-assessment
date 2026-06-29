/*
 * app/layout.tsx
 * -----------------------------------------------------------------------
 * Root layout for the Next.js App Router.
 *
 * Every page in this application is rendered inside the <html>/<body>
 * markup defined here. This is the correct place for:
 *   - Page-wide metadata (title/description shown in the browser tab and
 *     in link previews).
 *   - Global providers or wrappers that should apply to every route
 *     (none are needed yet, since this is a single-page demo, but this
 *     file is where they would go if the app grew additional routes).
 *
 * NOTE: the original `create-next-app` scaffold loaded the "Geist" font
 * family from Google Fonts via `next/font/google`. We deliberately
 * removed that here and rely on the system font stack defined in
 * `app/globals.css` instead -- this avoids an unnecessary external
 * network dependency at build time for a small demo app where a system
 * font is visually indistinguishable in a screen-shared recording.
 *
 * THEME INITIALIZATION: this file also injects a tiny inline script,
 * `THEME_INIT_SCRIPT` below, directly into <head>. Its only job is to
 * set the `data-theme` attribute on <html> SYNCHRONOUSLY, before the
 * browser paints anything and before React hydrates. Without this, the
 * page would always render in the light theme first (whatever
 * app/globals.css's default `:root` values are) and then "flash" to
 * dark a moment later once components/theme-toggle.tsx's React effect
 * runs on the client -- a jarring flicker on every load for anyone whose
 * stored preference is dark mode. Running this synchronously in <head>,
 * before <body> exists, eliminates that flash entirely.
 *
 * KNOWN, INTENTIONAL HYDRATION MISMATCH: this script sets `data-theme`
 * on the real DOM <html> element before React hydrates, but the JSX
 * below never sets that attribute itself (React has no way to know the
 * "right" value ahead of time -- it depends on the visitor's saved
 * preference). React's hydration algorithm always compares the
 * server-rendered markup against what it expects to render, and flags
 * this specific, deliberate attribute difference as an error. The fix
 * is `suppressHydrationWarning` on the <html> tag below -- the standard
 * pattern for exactly this "set an attribute via an inline script to
 * avoid a flash" technique (the same approach libraries like
 * next-themes use). It only suppresses mismatch warnings for this one
 * element's own attributes, not for any of its children, so it can't
 * accidentally hide an unrelated, real hydration bug elsewhere in the
 * tree.
 * -----------------------------------------------------------------------
 */

import type { Metadata } from "next";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

/**
 * Inline bootstrap script: reads the previously-saved theme from
 * localStorage, falling back to the operating system's color-scheme
 * preference if nothing has been saved yet, and applies it to <html>
 * immediately. Wrapped in a try/catch because reading localStorage can
 * throw in some locked-down embedded browser contexts -- if so, we
 * simply fall back to the light theme rather than letting the whole
 * page fail to render.
 */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved === "dark" || saved === "light" ? saved : (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (_error) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

// Metadata consumed by Next.js to populate the document <head>. Kept
// generic and accurate to what the app actually does, with no reference
// to any specific company name in the page title (the demo is designed
// to read as a general-purpose capability, not a branded product -- see
// the parent project's `context/POC_Design_Decisions.md`).
export const metadata: Metadata = {
  title: "TPO Agentic Reviewer",
  description:
    "A two-agent (Analyst + Auditor) reasoning pipeline that reviews healthcare Treatment, Payment, and Operations records and explains its anomaly-detection decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* dangerouslySetInnerHTML is intentional here: see the
            THEME_INIT_SCRIPT comment above for why this must run as a
            synchronous inline script rather than a React effect. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
