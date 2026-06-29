/*
 * components/step-navigator.tsx
 * -----------------------------------------------------------------------
 * The 4-step clickable progress indicator: Retrieval -> Analyst ->
 * Auditor -> Verdict. Replaces the earlier, non-interactive
 * pipeline-stepper -- this version lets the user click any step whose
 * data has already arrived to view that step's content in
 * components/step-content-panel.tsx, instead of forcing every stage's
 * output to be stacked into one long scrolling list.
 *
 * This component holds NO state of its own -- `statuses` and
 * `selectedStep` are both owned by app/page.tsx, which is the single
 * source of truth for pipeline progress. This component only turns that
 * state into clickable UI and reports clicks back via `onSelectStep`.
 * -----------------------------------------------------------------------
 */

import styles from "./step-navigator.module.css";

export type StepKey = "retrieve" | "analyst" | "auditor" | "verdict";

/** A step's visual/interactive state:
 *   - "pending": not reached yet, not clickable.
 *   - "active": currently running (shows a spinner bubble), clickable
 *     (so the user can watch it "thinking" if they navigate to it).
 *   - "complete": finished, has data, fully clickable.
 *   - "error": this step's request failed -- clickable (so the user can
 *     see what happened), but visually distinct from "complete" so it
 *     never looks like the pipeline silently succeeded. Without this
 *     state, a failed step had nowhere to go but "pending" (un-
 *     clickable, looks like it never started) or stuck showing its
 *     loading spinner forever -- neither of which reflects what
 *     actually happened. */
export type StepStatus = "pending" | "active" | "complete" | "error";

const STEP_ORDER: { key: StepKey; label: string }[] = [
  { key: "retrieve", label: "Retrieval" },
  { key: "analyst", label: "Analyst" },
  { key: "auditor", label: "Auditor" },
  { key: "verdict", label: "Verdict" },
];

interface StepNavigatorProps {
  statuses: Record<StepKey, StepStatus>;
  selectedStep: StepKey | null;
  onSelectStep: (step: StepKey) => void;
}

export function StepNavigator({ statuses, selectedStep, onSelectStep }: StepNavigatorProps) {
  return (
    <nav className={styles.nav} aria-label="Review pipeline progress">
      {STEP_ORDER.map(({ key, label }, index) => {
        const status = statuses[key];
        const isClickable = status !== "pending";
        const isSelected = selectedStep === key;

        return (
          <div className={styles.step} key={key}>
            <button
              type="button"
              className={styles.stepButton}
              disabled={!isClickable}
              onClick={() => onSelectStep(key)}
              aria-current={isSelected ? "step" : undefined}
            >
              <span
                className={[
                  styles.bubble,
                  status === "active" ? styles.bubbleActive : "",
                  status === "complete" ? styles.bubbleComplete : "",
                  status === "error" ? styles.bubbleError : "",
                  isSelected ? styles.bubbleSelected : "",
                ].join(" ")}
              >
                {status === "active" ? (
                  <span className={styles.bubbleSpinner} />
                ) : status === "complete" ? (
                  "✓"
                ) : status === "error" ? (
                  "!"
                ) : (
                  index + 1
                )}
              </span>
              <span className={[styles.label, isSelected ? styles.labelActive : ""].join(" ")}>
                {label}
              </span>
            </button>
            {index < STEP_ORDER.length - 1 && (
              <div
                className={[
                  styles.connector,
                  status === "complete" ? styles.connectorComplete : "",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
