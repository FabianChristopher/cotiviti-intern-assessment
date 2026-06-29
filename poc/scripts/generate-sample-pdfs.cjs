/*
 * scripts/generate-sample-pdfs.cjs
 * -----------------------------------------------------------------------
 * ONE-OFF CONTENT-AUTHORING SCRIPT -- NOT PART OF THE APPLICATION RUNTIME.
 *
 * This script exists solely to author the three bundled sample PDF
 * records used by the demo (one per TPO category: a claim, a treatment
 * record, and an ops record). It is run manually, once, by a developer
 * to produce static files under public/samples/ -- the deployed
 * application never executes this script and does not depend on the
 * `pdfkit` package it uses.
 *
 * Per project convention (see the parent project's CLAUDE.md "GOD RULES",
 * rule 3 on lean/deliberate dependencies), `pdfkit` is installed with
 * `--no-save` specifically so it is NOT added to package.json -- it is a
 * throwaway authoring tool, not a production or even a build-time
 * dependency of the actual reviewer application.
 *
 * Usage: node scripts/generate-sample-pdfs.cjs
 * -----------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUTPUT_DIR = path.join(__dirname, "..", "data", "samples");

/**
 * Renders a simple title + monospace-ish body block to a new PDF file.
 * Kept intentionally minimal -- these are meant to look like plain
 * internal records, not polished marketing documents.
 */
function writePdf(filename, title, bodyLines) {
  const doc = new PDFDocument({ margin: 50 });
  const outputPath = path.join(OUTPUT_DIR, filename);
  doc.pipe(fs.createWriteStream(outputPath));

  doc.fontSize(16).font("Helvetica-Bold").text(title);
  doc.moveDown(1);
  doc.fontSize(11).font("Helvetica");

  for (const line of bodyLines) {
    if (line === "") {
      doc.moveDown(0.5);
    } else {
      doc.text(line);
    }
  }

  doc.end();
  console.log(`Wrote ${outputPath}`);
}

// ---------------------------------------------------------------------
// Sample 1 (Payment category, FLAGGED): a claim with a billed amount far
// above the contracted rate and a procedure/diagnosis mismatch.
// ---------------------------------------------------------------------
writePdf("claim-002-flagged.pdf", "OUTPATIENT CLAIM RECORD", [
  "Claim ID: CLM-2026-05892",
  "Patient ID: PT-44109",
  "Provider: Briarwood Outpatient Surgical Center (NPI 1037485920)",
  "Date of Service: 2026-05-20",
  "Place of Service: 24 (Ambulatory Surgical Center)",
  "",
  "Procedure Code: CPT 29881 - Knee arthroscopy with meniscectomy",
  "Diagnosis Code: ICD-10 J06.9 - Acute upper respiratory infection, unspecified",
  "",
  "Billed Amount: $18,400.00",
  "Contracted (Allowed) Amount for CPT 29881 in this region: $4,250.00",
  "",
  "Notes:",
  "Billed amount is more than 4x the contracted rate for this procedure.",
  "The diagnosis code (upper respiratory infection) does not clinically",
  "support the billed procedure (knee arthroscopy). This is the third",
  "claim from this provider in the past 90 days billing CPT 29881 with",
  "a mismatched, low-acuity diagnosis code.",
]);

// ---------------------------------------------------------------------
// Sample 2 (Treatment category, CLEAR): a well-managed care plan with
// good adherence and improving clinical markers.
// ---------------------------------------------------------------------
writePdf("treatment-001-clear.pdf", "TREATMENT ADHERENCE SUMMARY", [
  "Patient ID: PT-22950",
  "Care Plan: Type 2 Diabetes Management Program",
  "Prescribed Regimen: Metformin 500mg twice daily; quarterly A1C lab",
  "draws; bi-annual ophthalmology screening",
  "Adherence Period Reviewed: 2026-01-01 to 2026-06-01",
  "",
  "Medication Refill Adherence: 96% (pharmacy refill records show",
  "consistent on-time pickups)",
  "Lab Draws Completed: 2 of 2 scheduled A1C draws completed on time",
  "Most Recent A1C: 6.8% (improved from 7.4% six months prior)",
  "Ophthalmology Screening: Completed 2026-03-02, no diabetic",
  "retinopathy findings",
  "",
  "Notes:",
  "Patient adherence and clinical markers are consistent with an",
  "effectively managed care plan. No gaps identified in the review",
  "period.",
]);

// ---------------------------------------------------------------------
// Sample 3 (Operations category, FLAGGED): a unit operating with a
// dangerously low nurse-to-patient ratio and a spike in incident reports.
// ---------------------------------------------------------------------
writePdf("ops-002-flagged.pdf", "DAILY UNIT STAFFING & CENSUS LOG", [
  "Unit: Med-Surg Floor 5A",
  "Date: 2026-05-19",
  "",
  "Patient Census: 34",
  "Scheduled Nursing Staff: 3 RNs, 1 CNA (4 total caregivers)",
  "Nurse-to-Patient Ratio: 1:11 (unit's target range is 1:4 to 1:5)",
  "Overtime Hours Logged: 22 hours (more than 4x the unit's trailing",
  "30-day average of 5.1 hours)",
  "Incident Reports Filed: 3 (medication delay, patient fall, missed",
  "vital-sign check)",
  "",
  "Notes:",
  "Staffing ratio is more than double the unit's target maximum. This",
  "is the second consecutive day this unit has operated below 1:8.",
  "Incident reports filed on this single shift exceed the unit's",
  "average for an entire month.",
]);
