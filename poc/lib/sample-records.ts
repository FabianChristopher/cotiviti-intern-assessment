/*
 * lib/sample-records.ts
 * -----------------------------------------------------------------------
 * Metadata describing the 6 bundled sample records (see
 * public/samples/). This is UI-facing metadata (display labels, which
 * static file each one maps to) -- it deliberately does NOT duplicate
 * the records' actual content, which lives only in the files
 * themselves.
 *
 * The "Load sample" buttons in components/upload-panel.tsx use this
 * list to fetch a bundled file from public/samples/ and feed it through
 * the exact same upload code path as a real, manually-chosen file --
 * see app/page.tsx for where that fetch happens. This keeps "click a
 * sample button" and "choose a file from disk" as two entry points into
 * one identical pipeline, rather than two separate code paths to
 * maintain.
 * -----------------------------------------------------------------------
 */

import type { TpoCategory } from "@/types/review";

export interface SampleRecordMeta {
  /** Stable identifier for use as a React key / button value. */
  id: string;
  /** Human-readable label shown on the "Load sample" button. */
  label: string;
  category: TpoCategory;
  /** Filename under public/samples/ -- combine with "/samples/" to get
   *  the fetchable URL path (see app/page.tsx). */
  filename: string;
}

export const SAMPLE_RECORDS: SampleRecordMeta[] = [
  {
    id: "claim-clear",
    label: "Claim — Routine Office Visit (expected: clear)",
    category: "payment",
    filename: "claim-001-clear.txt",
  },
  {
    id: "claim-flagged",
    label: "Claim — Knee Arthroscopy (expected: flagged)",
    category: "payment",
    filename: "claim-002-flagged.pdf",
  },
  {
    id: "treatment-clear",
    label: "Treatment — Diabetes Care Plan, well-managed (expected: clear)",
    category: "treatment",
    filename: "treatment-001-clear.pdf",
  },
  {
    id: "treatment-flagged",
    label: "Treatment — Diabetes Care Plan, adherence gap (expected: flagged)",
    category: "treatment",
    filename: "treatment-002-flagged.txt",
  },
  {
    id: "ops-clear",
    label: "Operations — Unit Staffing Log, normal (expected: clear)",
    category: "operations",
    filename: "ops-001-clear.txt",
  },
  {
    id: "ops-flagged",
    label: "Operations — Unit Staffing Log, understaffed (expected: flagged)",
    category: "operations",
    filename: "ops-002-flagged.pdf",
  },
];
