/*
 * lib/theme.ts
 * -----------------------------------------------------------------------
 * The single source of truth for the localStorage key used to persist
 * the user's light/dark theme preference.
 *
 * This constant is read from TWO independent places that must agree on
 * its exact value: the inline bootstrap script in app/layout.tsx
 * (which runs before React hydrates, to avoid a flash of the wrong
 * theme) and components/theme-toggle.tsx (which writes to it whenever
 * the user clicks the toggle). Before this file existed, both of those
 * defined the same string as a separate local constant -- functionally
 * identical today, but a latent bug waiting to happen: editing one
 * without noticing the other would silently break theme persistence in
 * a way that would be confusing to debug (the toggle would still work
 * within a session, but the saved preference would never be read back
 * correctly on the next visit). Importing one shared constant makes
 * that class of bug impossible.
 * -----------------------------------------------------------------------
 */

export const THEME_STORAGE_KEY = "tpo-reviewer-theme";
