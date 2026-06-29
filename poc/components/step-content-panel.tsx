/*
 * components/step-content-panel.tsx
 * -----------------------------------------------------------------------
 * Renders the content for WHICHEVER ONE pipeline step is currently
 * selected -- Retrieval, Analyst, Auditor, or Verdict. Only one of these
 * views is ever on screen at a time (selected via
 * components/step-navigator.tsx), which is what replaces the earlier
 * design's single long scrolling stack of every stage's output at once.
 *
 * Per the project's content requirements, this component deliberately
 * avoids rendering long prose paragraphs: Analyst/Auditor output is
 * shown as a one-line summary, a short bulleted "key points" list, and
 * clickable citation chips referencing the retrieved reference
 * snippets -- and the Verdict view shows ONLY the final decision, never
 * a repeat of the agents' bullet points.
 * -----------------------------------------------------------------------
 */

import type { AnalystOutput, AuditorOutput, RetrievalResult } from "@/types/review";
import type { StepKey, StepStatus } from "./step-navigator";
import { CategoryTag } from "./category-tag";
import styles from "./step-content-panel.module.css";

interface StepContentPanelProps {
  selectedStep: StepKey;
  statuses: Record<StepKey, StepStatus>;
  retrieval: RetrievalResult | null;
  analyst: AnalystOutput | null;
  auditor: AuditorOutput | null;
  /** The error message for whichever step failed (if any). Only ever
   *  relevant when `statuses[selectedStep] === "error"` -- shown inline
   *  in the panel instead of leaving that step's loading spinner
   *  running forever, which is what happened before this prop existed:
   *  a failed request had no visual outcome other than the generic
   *  error banner above the navigator, while the panel below it kept
   *  showing "Analyst is reasoning over the record…" indefinitely. */
  errorMessage?: string | null;
  /** Lets a citation chip jump the user straight to the Retrieval view
   *  to read the full text of a cited snippet. */
  onJumpToRetrieval: () => void;
}

export function StepContentPanel({
  selectedStep,
  statuses,
  retrieval,
  analyst,
  auditor,
  errorMessage,
  onJumpToRetrieval,
}: StepContentPanelProps) {
  const selectedStatus = statuses[selectedStep];

  // An errored step's content is identical regardless of which step it
  // was -- show this first, before any step-specific rendering, so
  // every step fails the same predictable way instead of each
  // render*View function needing its own duplicate error branch.
  if (selectedStatus === "error") {
    return (
      <div className={styles.panel} key={selectedStep}>
        <ErrorState text={errorMessage ?? "This step failed for an unknown reason."} />
      </div>
    );
  }

  // Re-mounting this element (via the `key`) every time `selectedStep`
  // changes is what makes the fade-in-up animation in
  // step-content-panel.module.css replay on every navigation, not just
  // on the very first render.
  return (
    <div className={styles.panel} key={selectedStep}>
      {selectedStep === "retrieve" && renderRetrievalView(statuses.retrieve, retrieval)}
      {selectedStep === "analyst" &&
        renderAnalystView(statuses.analyst, analyst, retrieval, onJumpToRetrieval)}
      {selectedStep === "auditor" &&
        renderAuditorView(statuses.auditor, auditor, retrieval, onJumpToRetrieval)}
      {selectedStep === "verdict" && renderVerdictView(auditor)}
    </div>
  );
}

function renderRetrievalView(status: StepStatus, retrieval: RetrievalResult | null) {
  if (status !== "complete" || !retrieval) {
    return <LoadingState text="Extracting text and matching reference guidelines…" />;
  }

  if (retrieval.retrievedSnippets.length === 0) {
    return (
      <p className={styles.retrievalMeta}>
        No reference snippets matched this record&rsquo;s content closely enough to retrieve.
      </p>
    );
  }

  return (
    <>
      <p className={styles.retrievalMeta}>
        {retrieval.retrievedSnippets.length} reference guideline
        {retrieval.retrievedSnippets.length === 1 ? "" : "s"} matched and passed to the Analyst as
        grounding context.
      </p>
      <div className={styles.snippetGrid}>
        {retrieval.retrievedSnippets.map((snippet) => (
          <div className={styles.snippetCard} key={snippet.id}>
            <div className={styles.snippetCardHeader}>
              <CategoryTag category={snippet.category} />
              <span className={styles.snippetId}>{snippet.id}</span>
              <span className={styles.snippetTitle}>{snippet.title}</span>
            </div>
            <p className={styles.snippetText}>{snippet.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function renderAnalystView(
  status: StepStatus,
  analyst: AnalystOutput | null,
  retrieval: RetrievalResult | null,
  onJumpToRetrieval: () => void,
) {
  if (status !== "complete" || !analyst) {
    return <LoadingState text="Analyst is reasoning over the record…" />;
  }

  return (
    <>
      <div className={styles.badgeRow}>
        <DecisionBadge decision={analyst.decision} />
        <span className={styles.certaintyText}>certainty: {analyst.certainty}</span>
      </div>
      <p className={styles.summary}>{analyst.findings.summary}</p>
      <p className={styles.sectionLabel}>Key findings</p>
      <ul className={styles.pointsList}>
        {analyst.findings.keyPoints.map((point, index) => (
          <li className={styles.pointItem} key={index}>
            <BulletIcon />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <CitationChips
        citedSnippetIds={analyst.citedSnippetIds}
        retrieval={retrieval}
        onJumpToRetrieval={onJumpToRetrieval}
      />
    </>
  );
}

function renderAuditorView(
  status: StepStatus,
  auditor: AuditorOutput | null,
  retrieval: RetrievalResult | null,
  onJumpToRetrieval: () => void,
) {
  if (status !== "complete" || !auditor) {
    return <LoadingState text="Auditor is independently reviewing the Analyst's decision…" />;
  }

  return (
    <>
      <div className={styles.badgeRow}>
        <AgreementBadge agreement={auditor.agreement} />
        <DecisionBadge decision={auditor.finalDecision} />
        <span className={styles.certaintyText}>certainty: {auditor.certainty}</span>
      </div>
      <p className={styles.summary}>{auditor.findings.summary}</p>
      <p className={styles.sectionLabel}>Audit notes</p>
      <ul className={styles.pointsList}>
        {auditor.findings.keyPoints.map((point, index) => (
          <li className={styles.pointItem} key={index}>
            <BulletIcon />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <CitationChips
        citedSnippetIds={auditor.citedSnippetIds}
        retrieval={retrieval}
        onJumpToRetrieval={onJumpToRetrieval}
      />
    </>
  );
}

function renderVerdictView(auditor: AuditorOutput | null) {
  if (!auditor) {
    return <LoadingState text="Awaiting the Auditor's final decision…" />;
  }

  const isFlagged = auditor.finalDecision === "flagged";
  const agreementNote = isFlagged
    ? auditor.agreement === "confirmed"
      ? "The Auditor independently confirmed the Analyst's flag after its own review."
      : "The Auditor flagged this record itself, overturning the Analyst's original \"clear\" assessment."
    : auditor.agreement === "confirmed"
      ? "The Auditor independently confirmed the Analyst's assessment that this record is clear."
      : "The Auditor cleared this record itself, overturning the Analyst's original flag.";

  return (
    <div className={styles.verdictWrap}>
      <span
        className={[
          styles.verdictIconWrap,
          isFlagged ? styles.verdictIconFlagged : styles.verdictIconClear,
        ].join(" ")}
      >
        {isFlagged ? <FlagIcon className={styles.verdictIcon} /> : <CheckIcon className={styles.verdictIcon} />}
      </span>
      <p className={styles.verdictEyebrow}>FINAL VERDICT</p>
      <p
        className={[
          styles.verdictDecision,
          isFlagged ? styles.verdictDecisionFlagged : styles.verdictDecisionClear,
        ].join(" ")}
      >
        {auditor.finalDecision.toUpperCase()}
      </p>
      <p className={styles.verdictCertainty}>Certainty: {auditor.certainty}</p>
      <p className={styles.verdictNote}>{agreementNote}</p>
    </div>
  );
}

/* ---- small shared sub-components ---- */

function LoadingState({ text }: { text: string }) {
  return (
    <div className={styles.loadingState}>
      <span className={styles.spinnerLarge} />
      <span>{text}</span>
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className={styles.errorState}>
      <OverturnIcon className={styles.errorIcon} />
      <span>{text}</span>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: "flagged" | "clear" }) {
  return (
    <span className={[styles.badge, decision === "flagged" ? styles.badgeFlagged : styles.badgeClear].join(" ")}>
      {decision === "flagged" ? <FlagIcon /> : <CheckIcon />}
      {decision.toUpperCase()}
    </span>
  );
}

function AgreementBadge({ agreement }: { agreement: "confirmed" | "overturned" }) {
  return (
    <span className={[styles.badge, styles.badgeNeutral].join(" ")}>
      {agreement === "confirmed" ? <CheckIcon /> : <OverturnIcon />}
      {agreement === "confirmed" ? "CONFIRMED" : "OVERTURNED"}
    </span>
  );
}

function CitationChips({
  citedSnippetIds,
  retrieval,
  onJumpToRetrieval,
}: {
  citedSnippetIds: string[];
  retrieval: RetrievalResult | null;
  onJumpToRetrieval: () => void;
}) {
  if (citedSnippetIds.length === 0 || !retrieval) {
    return null;
  }

  const citedSnippets = citedSnippetIds
    .map((id) => retrieval.retrievedSnippets.find((snippet) => snippet.id === id))
    .filter((snippet): snippet is NonNullable<typeof snippet> => snippet !== undefined);

  if (citedSnippets.length === 0) {
    return null;
  }

  return (
    <div className={styles.chipsRow}>
      {citedSnippets.map((snippet) => (
        <button key={snippet.id} type="button" className={styles.chip} onClick={onJumpToRetrieval}>
          {snippet.id}
        </button>
      ))}
    </div>
  );
}

/* Small hand-written inline SVG icons -- kept dependency-free (see God
   Rule 3 on lean, deliberate dependencies). */

function BulletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={styles.pointIcon}>
      <path d="M5 12.5 9.5 17 19 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={className ? undefined : "12"} height={className ? undefined : "12"} className={className}>
      <path d="M5 21V4h13l-3.2 4L18 12H5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={className ? undefined : "12"} height={className ? undefined : "12"} className={className}>
      <path d="M4 12.5 9 17.5 20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OverturnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width={className ? undefined : "12"}
      height={className ? undefined : "12"}
      className={className}
    >
      <path d="M12 9v4.5M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.6 3.7 2.9 18a1.5 1.5 0 0 0 1.3 2.2h15.6a1.5 1.5 0 0 0 1.3-2.2L13.4 3.7a1.5 1.5 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
