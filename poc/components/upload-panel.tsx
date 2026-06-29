/*
 * components/upload-panel.tsx
 * -----------------------------------------------------------------------
 * The record-selection UI: lets the user either
 *   (a) load one of the 6 bundled sample records (the primary,
 *       demo-reliable path -- see lib/sample-records.ts), or
 *   (b) upload an arbitrary .txt/.csv/.pdf file from their own machine, or
 *   (c) paste raw text directly (the secondary fallback path).
 *
 * All three paths converge on the same `onRunReview` callback with one
 * of two possible "source" shapes -- a File object, or a plain string of
 * pasted text -- so the parent (app/page.tsx) has exactly one place that
 * knows how to actually call the API, regardless of which input method
 * produced the record.
 * -----------------------------------------------------------------------
 */

"use client";

import { useState } from "react";
import { SAMPLE_RECORDS } from "@/lib/sample-records";
import { CategoryTag } from "./category-tag";
import styles from "./upload-panel.module.css";

/** The two possible "what should we submit" shapes. Using a discriminated
 *  union (the `kind` field) lets app/page.tsx branch on the source type
 *  with full type narrowing, rather than checking multiple optional
 *  fields for truthiness. */
export type ReviewSource =
  | { kind: "file"; file: File }
  | { kind: "text"; text: string };

interface UploadPanelProps {
  onRunReview: (source: ReviewSource) => void;
  /** True while a review is already in flight -- disables all controls
   *  so a user can't fire a second overlapping request mid-demo. */
  disabled: boolean;
}

export function UploadPanel({ onRunReview, disabled }: UploadPanelProps) {
  // Exactly one of these two pieces of local state is "active" at a
  // time -- selecting a sample or choosing a file clears any pasted
  // text, and typing in the textarea clears any selected file. This
  // avoids the ambiguous case of "the user has both a file and pasted
  // text staged -- which one do we actually submit?"
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  /** Set when fetching a bundled sample file fails (network issue, or
   *  the file 404s). Without this check, a failed fetch would silently
   *  wrap an HTML error page in a File object and hand it to the
   *  pipeline as if it were a real record, producing a confusing PDF/
   *  text-extraction error several steps later instead of a clear
   *  message right where the problem actually occurred. */
  const [sampleLoadError, setSampleLoadError] = useState<string | null>(null);

  /** Fetches a bundled sample file from public/samples/ and wraps it in
   *  a real File object, so it flows through the exact same "file"
   *  source shape as a manually-chosen upload -- see the file header
   *  comment for why this matters. */
  async function handleSelectSample(filename: string) {
    setSampleLoadError(null);
    try {
      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) {
        throw new Error(`Could not load sample file (status ${response.status}).`);
      }
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type });
      setSelectedFile(file);
      setPastedText("");
    } catch (error) {
      setSampleLoadError(
        error instanceof Error ? error.message : "Could not load this sample file.",
      );
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      setPastedText("");
    }
  }

  function handlePastedTextChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setPastedText(event.target.value);
    if (event.target.value.length > 0) {
      setSelectedFile(null);
    }
  }

  function handleRunReview() {
    if (selectedFile) {
      onRunReview({ kind: "file", file: selectedFile });
    } else if (pastedText.trim().length > 0) {
      onRunReview({ kind: "text", text: pastedText.trim() });
    }
  }

  const hasSelection = selectedFile !== null || pastedText.trim().length > 0;

  return (
    <div>
      <p className={styles.sectionLabel}>
        <SampleIcon /> Load a sample record
      </p>
      <div className={styles.sampleList}>
        {SAMPLE_RECORDS.map((sample) => {
          const isSelected = selectedFile?.name === sample.filename;
          return (
            <button
              key={sample.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelectSample(sample.filename)}
              className={[styles.sampleButton, isSelected ? styles.sampleButtonSelected : ""].join(
                " ",
              )}
            >
              <CategoryTag category={sample.category} />
              <span>{sample.label}</span>
            </button>
          );
        })}
      </div>
      {sampleLoadError && <p className={styles.sampleLoadError}>{sampleLoadError}</p>}

      <p className={styles.sectionLabel}>
        <UploadIcon /> Or upload your own file
      </p>
      <div className={styles.fileInputWrap}>
        <input
          type="file"
          accept=".txt,.csv,.pdf"
          disabled={disabled}
          onChange={handleFileInputChange}
          className={styles.fileInput}
        />
      </div>

      <p className={styles.sectionLabel}>
        <PasteIcon /> Or paste record text directly
      </p>
      <textarea
        value={pastedText}
        disabled={disabled}
        onChange={handlePastedTextChange}
        rows={4}
        placeholder="Paste the text of a record here…"
        className={styles.textarea}
      />

      {selectedFile && (
        <p className={styles.selectedFileNote}>
          <CheckCircleIcon /> Selected: {selectedFile.name}
        </p>
      )}

      <button
        type="button"
        disabled={disabled || !hasSelection}
        onClick={handleRunReview}
        className={styles.runButton}
      >
        {disabled ? "Running…" : "Run Review"}
      </button>
    </div>
  );
}

/* Small hand-written inline SVG icons -- kept dependency-free (see God
   Rule 3 on lean, deliberate dependencies) rather than pulling in an
   icon library for five glyphs used only in this one component. */

function SampleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <rect x="4" y="3" width="16" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="7.5" y1="8" x2="16.5" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M12 16V4M12 4 7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 16v2.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <rect x="6" y="4" width="12" height="17" rx="1.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.3 11 15.2 16 9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
