/*
 * components/history-list.tsx
 * -----------------------------------------------------------------------
 * Renders the list of past completed reviews (see lib/history.ts) in
 * the left pane when the app is in "history" mode -- this REPLACES the
 * UploadPanel entirely while history mode is active (see app/page.tsx),
 * it is not shown alongside it. Clicking an entry selects it for
 * display in the right pane (handled by app/page.tsx feeding that
 * entry's saved data into the same StepNavigator/StepContentPanel
 * components used for a live, in-progress review).
 * -----------------------------------------------------------------------
 */

"use client";

import type { HistoryEntry } from "@/types/review";
import styles from "./history-list.module.css";

interface HistoryListProps {
  entries: HistoryEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onClearHistory: () => void;
}

/** Formats an ISO timestamp as a short, locale-aware date + time string
 *  for display in the list -- e.g. "Jun 29, 3:41 PM" -- rather than the
 *  raw ISO string. */
function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HistoryList({
  entries,
  selectedEntryId,
  onSelectEntry,
  onClearHistory,
}: HistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className={styles.emptyState}>
        <HistoryIcon />
        <p>
          No past reviews yet. Completed reviews will appear here automatically once you run one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.list}>
        {entries.map((entry) => {
          const isFlagged = entry.auditor.finalDecision === "flagged";
          const isSelected = entry.id === selectedEntryId;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectEntry(entry.id)}
              className={[styles.entryButton, isSelected ? styles.entrySelected : ""].join(" ")}
            >
              <div className={styles.entryTopRow}>
                <span className={styles.entryPreview}>{entry.recordPreview}</span>
                <span
                  className={[
                    styles.entryBadge,
                    isFlagged ? styles.entryBadgeFlagged : styles.entryBadgeClear,
                  ].join(" ")}
                >
                  {entry.auditor.finalDecision.toUpperCase()}
                </span>
              </div>
              <span className={styles.entryTimestamp}>{formatTimestamp(entry.completedAt)}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.clearButton} onClick={onClearHistory}>
        Clear history
      </button>
    </div>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={styles.emptyStateIcon}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
