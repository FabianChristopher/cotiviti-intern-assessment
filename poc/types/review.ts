/*
 * types/review.ts
 * -----------------------------------------------------------------------
 * Shared TypeScript types describing the data that flows through the
 * review pipeline. The pipeline is now THREE separate, honestly-timed
 * network calls (not one combined request) so the UI can show a real
 * loading state for each stage instead of faking a delay after the fact:
 *
 *   1. POST /api/review/retrieve  -> RetrievalResult
 *        (extract text from the uploaded record, then keyword-match it
 *        against the static reference snippet library)
 *   2. POST /api/review/analyst   -> AnalystOutput
 *        (the Analyst agent reasons over the record + retrieved snippets)
 *   3. POST /api/review/auditor   -> AuditorOutput
 *        (the Auditor agent critiques the Analyst's output and decides
 *        the final, authoritative verdict)
 *
 * Centralizing these shapes in one file means the API routes, the
 * agents, and the UI components all import from a single source of
 * truth -- if a field is renamed, TypeScript flags every place that
 * needs to be updated, instead of a typo silently producing `undefined`
 * at runtime.
 * -----------------------------------------------------------------------
 */

/** The three Treatment / Payment / Operations categories the assessment
 *  topic itself names. Every sample record and every reference snippet
 *  belongs to exactly one of these. */
export type TpoCategory = "treatment" | "payment" | "operations";

/** A binary "is this record worth a second look" decision. A closed
 *  string union (rather than a free-form string) so the compiler -- not
 *  a runtime check -- catches a typo like "Flagged" vs "flagged"
 *  anywhere a decision is produced or consumed. */
export type Decision = "flagged" | "clear";

/** Qualitative certainty levels. We intentionally do NOT use a numeric
 *  confidence percentage -- a self-reported number from an LLM is not a
 *  statistically calibrated probability, and would be an easy point of
 *  attack in an interview ("how was that number computed?"). */
export type CertaintyLevel = "low" | "medium" | "high";

/** A single static, hand-authored reference snippet used by the
 *  lightweight retrieval step (see lib/retrieval/). These represent
 *  generic billing-policy rules, treatment-guideline excerpts, and
 *  operations/staffing norms -- illustrative reference points for the
 *  demo, not real regulatory or company-specific policy text. */
export interface ReferenceSnippet {
  /** Stable identifier, used so agent output can cite exactly which
   *  snippet(s) informed a decision (e.g. "REF-PAY-01"). */
  id: string;
  category: TpoCategory;
  title: string;
  /** Lowercase keywords/phrases used by the keyword-overlap matcher in
   *  lib/retrieval/match.ts. */
  keywords: string[];
  /** The actual guideline/policy text passed into the agents' prompts as
   *  grounding context. */
  text: string;
}

/**
 * Result of the FIRST pipeline stage: extracting the record's plain
 * text and retrieving relevant reference snippets for it. Returned by
 * POST /api/review/retrieve. This stage involves no LLM call -- it is
 * pure text extraction + keyword matching -- so it genuinely completes
 * in well under a second, which is reflected honestly in the UI rather
 * than padded with an artificial delay.
 */
export interface RetrievalResult {
  recordText: string;
  retrievedSnippets: ReferenceSnippet[];
}

/**
 * A single piece of structured reasoning output from either agent: a
 * one-line summary plus a small set of short, scannable bullet points.
 * We deliberately moved away from a single long prose paragraph (the
 * original design) to this structure -- the intended audience for this
 * tool (insurance/medical reviewers) needs to scan a decision quickly,
 * not read a paragraph end-to-end. Both AnalystOutput and AuditorOutput
 * embed one of these.
 */
export interface StructuredFinding {
  /** A single sentence capturing the overall takeaway -- shown
   *  prominently at the top of the step's content panel. */
  summary: string;
  /** 3-6 short, independent bullet points supporting the summary. Kept
   *  short (one sentence each) so they render as a scannable list, not
   *  another wall of text. */
  keyPoints: string[];
}

/**
 * Output produced by the Analyst agent (see lib/agents/analyst.ts).
 * This is the FIRST pass over the record -- it is explicitly expected to
 * be reviewed and potentially overturned by the Auditor agent, so it is
 * never shown to the end user as a final answer on its own.
 */
export interface AnalystOutput {
  decision: Decision;
  certainty: CertaintyLevel;
  findings: StructuredFinding;
  /** IDs of the reference snippets the Analyst's reasoning actually
   *  relied on, so the UI can visibly show which retrieved snippet(s)
   *  grounded the decision rather than presenting retrieval as
   *  decorative. */
  citedSnippetIds: string[];
}

/**
 * Output produced by the Auditor agent (see lib/agents/auditor.ts). This
 * is the SECOND, authoritative pass -- `finalDecision` here is what gets
 * surfaced as the pipeline's actual verdict, not `AnalystOutput.decision`.
 */
export interface AuditorOutput {
  /** Whether the Auditor agreed with or overturned the Analyst's
   *  original decision -- shown so the UI can visibly narrate the
   *  hand-off, which is the whole point of the two-agent review
   *  pattern. */
  agreement: "confirmed" | "overturned";
  finalDecision: Decision;
  certainty: CertaintyLevel;
  findings: StructuredFinding;
  citedSnippetIds: string[];
}

/**
 * A single completed run of the full pipeline, saved to the browser's
 * History list (see lib/history.ts) once the Auditor stage finishes.
 * This is a plain snapshot of everything the user saw for one record --
 * the History feature does not re-run anything, it just lets the user
 * come back and re-view a past result exactly as it was, by feeding
 * this same data back into the existing StepNavigator/StepContentPanel
 * components used for the live pipeline.
 *
 * Deliberately NOT saved for failed/in-progress runs -- only a fully
 * completed review (one that reached a final verdict) is meaningful to
 * keep in history.
 */
export interface HistoryEntry {
  /** Stable identifier (timestamp-based) used as the React list key and
   *  for selecting/removing a specific entry. */
  id: string;
  /** ISO 8601 timestamp of when this review completed, shown in the
   *  history list and usable for sorting newest-first. */
  completedAt: string;
  /** A short, human-scannable label for the history list -- derived
   *  from the record's own text (its first non-empty line), not a
   *  separate user-entered title, since records don't have one. */
  recordPreview: string;
  retrieval: RetrievalResult;
  analyst: AnalystOutput;
  auditor: AuditorOutput;
}
