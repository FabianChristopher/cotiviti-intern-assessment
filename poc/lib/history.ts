/*
 * lib/history.ts
 * -----------------------------------------------------------------------
 * Persistence for the "History / Past Records" feature: every fully
 * completed review (one that reached a final Auditor verdict) is saved
 * to the browser's localStorage so the user can navigate away and come
 * back to it later, in the same browser, without re-running the agents.
 *
 * DELIBERATELY NO BACKEND/DATABASE: this is consistent with the rest of
 * the project's "lean, no unnecessary infrastructure" approach (see
 * context/POC_Design_Decisions.md, "Tech Stack & Deployment" --
 * "No database needed"). History only needs to survive across page
 * navigations/reloads in one browser for one demo session, which
 * localStorage does perfectly well; a real multi-user product would
 * need a server-side store, but that is out of scope for this proof of
 * concept.
 *
 * All functions here are safe to call during server-side rendering --
 * they no-op (or return an empty list) if `window`/`localStorage`
 * aren't available, since Next.js can execute this module's imports in
 * a server context even though the functions are only ever actually
 * invoked from "use client" components.
 * -----------------------------------------------------------------------
 */

import type { AnalystOutput, AuditorOutput, HistoryEntry, RetrievalResult } from "@/types/review";

const STORAGE_KEY = "tpo-reviewer-history";

/** Maximum number of past records kept. Oldest entries are dropped once
 *  this is exceeded -- prevents unbounded growth of localStorage across
 *  a long demo/testing session. */
const MAX_HISTORY_ENTRIES = 25;

/** How many characters of the record's first line to keep for the
 *  history list preview, before truncating with an ellipsis. */
const PREVIEW_MAX_LENGTH = 60;

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Derives a short, human-scannable label for a record from its own
 * text -- records don't have a separate user-entered title, so we use
 * the first non-empty line (most of our sample records start with a
 * heading like "OUTPATIENT CLAIM RECORD"), truncated if it's long.
 */
function deriveRecordPreview(recordText: string): string {
  const firstLine = recordText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return "Untitled record";
  }

  return firstLine.length > PREVIEW_MAX_LENGTH
    ? `${firstLine.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`
    : firstLine;
}

/**
 * Reads the saved history list from localStorage, newest-first. Returns
 * an empty array (rather than throwing) if storage is unavailable, the
 * key has never been set, or the stored value is somehow malformed --
 * a corrupted history list should never prevent the rest of the app
 * from working.
 */
export function loadHistory(): HistoryEntry[] {
  if (!isStorageAvailable()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Builds a HistoryEntry from a just-completed pipeline run and saves it
 * (prepended, so the list stays newest-first) to localStorage, trimming
 * to MAX_HISTORY_ENTRIES. Returns the updated list so the caller can
 * immediately update its React state without a separate loadHistory()
 * round-trip.
 */
export function saveHistoryEntry(
  retrieval: RetrievalResult,
  analyst: AnalystOutput,
  auditor: AuditorOutput,
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt: new Date().toISOString(),
    recordPreview: deriveRecordPreview(retrieval.recordText),
    retrieval,
    analyst,
    auditor,
  };

  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY_ENTRIES);

  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // If localStorage is full or otherwise unwritable, the entry
      // still exists in the returned in-memory list for this session --
      // we simply lose persistence across reloads, which is an
      // acceptable degradation rather than a crash.
    }
  }

  return updated;
}

/** Clears all saved history. Used by the "Clear history" action in
 *  components/history-list.tsx. */
export function clearHistory(): void {
  if (isStorageAvailable()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
