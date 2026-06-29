/*
 * app/page.tsx
 * -----------------------------------------------------------------------
 * The single page of this demo application: a fixed-viewport, two-pane
 * dashboard (see app/page.module.css for the layout shell).
 *
 * The page has two MODES, switched via the Home/History buttons in the
 * header:
 *   - "review" (default): left pane = UploadPanel (choose/upload a
 *     record), right pane = the live, in-progress or just-completed
 *     pipeline for whatever was last submitted.
 *   - "history": left pane = HistoryList (past completed reviews,
 *     persisted in localStorage -- see lib/history.ts), right pane =
 *     the full pipeline view for whichever past entry is selected.
 * Both modes' right-pane views reuse the exact same StepNavigator and
 * StepContentPanel components -- a history entry is just a frozen
 * snapshot of the same `{ retrieval, analyst, auditor }` shape the live
 * pipeline produces, so no separate "history viewer" UI was needed.
 *
 * THREE REAL, SEPARATELY-TIMED REQUESTS: this component calls
 * POST /api/review/retrieve, then POST /api/review/analyst, then
 * POST /api/review/auditor, strictly in sequence (each one depends on
 * the previous one's output). Each step's loading spinner in the UI
 * therefore reflects the genuine latency of that step's own work --
 * retrieval finishes almost instantly (no LLM call), while the Analyst
 * and Auditor steps each take as long as their own Claude API call
 * actually takes.
 * -----------------------------------------------------------------------
 */

"use client";

import { useEffect, useState } from "react";
import { UploadPanel, type ReviewSource } from "@/components/upload-panel";
import { StepNavigator, type StepKey, type StepStatus } from "@/components/step-navigator";
import { StepContentPanel } from "@/components/step-content-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { HistoryList } from "@/components/history-list";
import { clearHistory, loadHistory, saveHistoryEntry } from "@/lib/history";
import type { AnalystOutput, AuditorOutput, HistoryEntry, RetrievalResult } from "@/types/review";
import styles from "./page.module.css";

/** The overall lifecycle of a single review request. Modeled as one
 *  string union rather than several independent booleans so it is
 *  impossible to represent an invalid combination of states (e.g.
 *  "analyzing" and "auditing" both true at once). */
type PipelineStage = "idle" | "retrieving" | "analyzing" | "auditing" | "done" | "error";

/** Which left/right pane content is currently showing. */
type PageMode = "review" | "history";

/** Every step of a saved History entry is, by definition, already
 *  complete -- there is no "active"/loading state for something that
 *  finished in the past. Declared once here rather than recomputed on
 *  every render. */
const ALL_STEPS_COMPLETE: Record<StepKey, StepStatus> = {
  retrieve: "complete",
  analyst: "complete",
  auditor: "complete",
  verdict: "complete",
};

export default function HomePage() {
  const [mode, setMode] = useState<PageMode>("review");

  // --- live "review" mode state ---
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [retrieval, setRetrieval] = useState<RetrievalResult | null>(null);
  const [analyst, setAnalyst] = useState<AnalystOutput | null>(null);
  const [auditor, setAuditor] = useState<AuditorOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Which step was in progress when a request failed, if any -- lets
   *  the navigator and content panel show that specific step as
   *  "error" instead of leaving it stuck on its loading spinner
   *  forever (the bug this fixes: previously a failed Analyst/Auditor
   *  call only showed the generic error banner, while the step's own
   *  content panel kept showing "reasoning over the record…"
   *  indefinitely with no indication anything had gone wrong). */
  const [failedStep, setFailedStep] = useState<StepKey | null>(null);
  const [selectedStep, setSelectedStep] = useState<StepKey | null>(null);

  // --- "history" mode state ---
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historySelectedStep, setHistorySelectedStep] = useState<StepKey>("verdict");

  // Load any previously-saved history once, on first mount. This reads
  // localStorage, which only exists in the browser, so it must happen in
  // an effect rather than during the initial render (which can also run
  // on the server) -- the same justified exception to the lint rule
  // below as components/theme-toggle.tsx's on-mount DOM read; see that
  // file's comment for the full reasoning.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryEntries(loadHistory());
  }, []);

  const isRunning = stage === "retrieving" || stage === "analyzing" || stage === "auditing";

  /** Orchestrates the full 3-request pipeline for one submitted record,
   *  then saves the completed result to History. This is the one place
   *  in the app that calls fetch() -- both the sample-record path and
   *  the free-text path in UploadPanel converge here via the
   *  ReviewSource union. */
  async function handleRunReview(source: ReviewSource) {
    setRetrieval(null);
    setAnalyst(null);
    setAuditor(null);
    setErrorMessage(null);
    setFailedStep(null);

    // Tracked as a plain local variable, not state -- we need to know
    // which step was in flight at the exact moment an error is thrown,
    // and a local variable captured by this closure gives us that
    // immediately, with no risk of reading a stale value the way a
    // state variable could if read inside the same synchronous
    // try/catch it was just set in.
    let currentStep: StepKey = "retrieve";

    try {
      setStage("retrieving");
      setSelectedStep("retrieve");
      const retrievalResult = await callRetrieve(source);
      setRetrieval(retrievalResult);

      currentStep = "analyst";
      setStage("analyzing");
      setSelectedStep("analyst");
      const analystResult = await callAnalyst(retrievalResult);
      setAnalyst(analystResult);

      currentStep = "auditor";
      setStage("auditing");
      setSelectedStep("auditor");
      const auditorResult = await callAuditor(retrievalResult, analystResult);
      setAuditor(auditorResult);

      setStage("done");
      setSelectedStep("verdict");

      // Only a fully completed review (one that reached a final
      // verdict) is meaningful to keep in history -- a failed or
      // abandoned run is not saved.
      setHistoryEntries(saveHistoryEntry(retrievalResult, analystResult, auditorResult));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The review failed.");
      setFailedStep(currentStep);
      setStage("error");
    }
  }

  const liveStatuses: Record<StepKey, StepStatus> = {
    retrieve:
      failedStep === "retrieve"
        ? "error"
        : stage === "retrieving"
          ? "active"
          : retrieval
            ? "complete"
            : "pending",
    analyst:
      failedStep === "analyst"
        ? "error"
        : stage === "analyzing"
          ? "active"
          : analyst
            ? "complete"
            : "pending",
    auditor:
      failedStep === "auditor"
        ? "error"
        : stage === "auditing"
          ? "active"
          : auditor
            ? "complete"
            : "pending",
    verdict: auditor ? "complete" : "pending",
  };

  function handleSelectLiveStep(step: StepKey) {
    if (liveStatuses[step] !== "pending") {
      setSelectedStep(step);
    }
  }

  function handleSelectHistoryEntry(id: string) {
    setSelectedHistoryId(id);
    setHistorySelectedStep("verdict");
  }

  function handleClearHistory() {
    clearHistory();
    setHistoryEntries([]);
    setSelectedHistoryId(null);
  }

  const hasStartedReview = stage !== "idle";
  const selectedHistoryEntry = historyEntries.find((entry) => entry.id === selectedHistoryId) ?? null;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.title}>TPO Agentic Reviewer</span>
          <span className={styles.subtitle}>
            Two-agent (Analyst + Auditor) reasoning over Treatment, Payment &amp; Operations
            records, grounded in a retrieved reference library.
          </span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => setMode("review")}
            className={[styles.navButton, mode === "review" ? styles.navButtonActive : ""].join(
              " ",
            )}
          >
            <HomeIcon /> Home
          </button>
          <button
            type="button"
            onClick={() => setMode("history")}
            className={[styles.navButton, mode === "history" ? styles.navButtonActive : ""].join(
              " ",
            )}
          >
            <HistoryIcon /> History
            {historyEntries.length > 0 ? ` (${historyEntries.length})` : ""}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.pane}>
          <h1 className={styles.paneHeading}>
            {mode === "review" ? "1. Choose a record to review" : "Past reviews"}
          </h1>
          {mode === "review" ? (
            <UploadPanel onRunReview={handleRunReview} disabled={isRunning} />
          ) : (
            <HistoryList
              entries={historyEntries}
              selectedEntryId={selectedHistoryId}
              onSelectEntry={handleSelectHistoryEntry}
              onClearHistory={handleClearHistory}
            />
          )}
        </section>

        <section className={styles.pane}>
          {mode === "review" && !hasStartedReview && (
            <div className={styles.emptyState}>
              <PipelineIcon />
              <p>
                Select or upload a record on the left, then click Run Review to see the two-agent
                pipeline in action here. Each step below becomes clickable as soon as it
                completes.
              </p>
            </div>
          )}

          {mode === "review" && hasStartedReview && (
            <>
              <h2 className={styles.paneHeading}>2. Review pipeline</h2>
              <StepNavigator
                statuses={liveStatuses}
                selectedStep={selectedStep}
                onSelectStep={handleSelectLiveStep}
              />

              {stage === "error" && errorMessage && (
                <p className={styles.errorBanner}>Error: {errorMessage}</p>
              )}

              {selectedStep && (
                <StepContentPanel
                  selectedStep={selectedStep}
                  statuses={liveStatuses}
                  retrieval={retrieval}
                  analyst={analyst}
                  auditor={auditor}
                  errorMessage={errorMessage}
                  onJumpToRetrieval={() => handleSelectLiveStep("retrieve")}
                />
              )}
            </>
          )}

          {mode === "history" && !selectedHistoryEntry && (
            <div className={styles.emptyState}>
              <PipelineIcon />
              <p>Select a past record on the left to view its full review pipeline here.</p>
            </div>
          )}

          {mode === "history" && selectedHistoryEntry && (
            <>
              <h2 className={styles.paneHeading}>Reviewing: {selectedHistoryEntry.recordPreview}</h2>
              <StepNavigator
                statuses={ALL_STEPS_COMPLETE}
                selectedStep={historySelectedStep}
                onSelectStep={setHistorySelectedStep}
              />
              <StepContentPanel
                selectedStep={historySelectedStep}
                statuses={ALL_STEPS_COMPLETE}
                retrieval={selectedHistoryEntry.retrieval}
                analyst={selectedHistoryEntry.analyst}
                auditor={selectedHistoryEntry.auditor}
                onJumpToRetrieval={() => setHistorySelectedStep("retrieve")}
              />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

/* ---- network calls: one function per pipeline stage ---- */

async function callRetrieve(source: ReviewSource): Promise<RetrievalResult> {
  const response =
    source.kind === "file"
      ? await fetch("/api/review/retrieve", {
          method: "POST",
          body: toFormData(source.file),
        })
      : await fetch("/api/review/retrieve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: source.text }),
        });

  return parseJsonOrThrow<RetrievalResult>(response);
}

async function callAnalyst(retrieval: RetrievalResult): Promise<AnalystOutput> {
  const response = await fetch("/api/review/analyst", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordText: retrieval.recordText,
      retrievedSnippets: retrieval.retrievedSnippets,
    }),
  });

  const body = await parseJsonOrThrow<{ analyst: AnalystOutput }>(response);
  return body.analyst;
}

async function callAuditor(
  retrieval: RetrievalResult,
  analyst: AnalystOutput,
): Promise<AuditorOutput> {
  const response = await fetch("/api/review/auditor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordText: retrieval.recordText,
      retrievedSnippets: retrieval.retrievedSnippets,
      analyst,
    }),
  });

  const body = await parseJsonOrThrow<{ auditor: AuditorOutput }>(response);
  return body.auditor;
}

function toFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

/** Shared response handler for all three pipeline requests: parses the
 *  JSON body and throws a clear error (using the API's own `{ error }`
 *  message when present) if the response wasn't successful, rather than
 *  letting each call site duplicate this same try/parse/throw logic. */
async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed with status ${response.status}.`);
  }
  return body;
}

function PipelineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={styles.emptyStateIcon}>
      <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8.3" y1="11" x2="15.7" y2="7" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8.3" y1="13" x2="15.7" y2="17" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9.5a.5.5 0 0 0 .5.5H9.5a.5.5 0 0 0 .5-.5V15a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
