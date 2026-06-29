/*
 * lib/retrieval/snippets.ts
 * -----------------------------------------------------------------------
 * The static, hand-authored "reference library" used by the lightweight
 * retrieval step that runs before the Analyst agent reasons about a
 * record (see context/POC_Design_Decisions.md, section "Agent
 * Architecture" in the parent project, for the full rationale).
 *
 * IMPORTANT -- what this is and is NOT:
 *   - This is a small, fixed, in-memory array of generic guideline/policy
 *     text -- NOT a real regulatory rules database, NOT scraped from any
 *     specific company's actual policy documents, and NOT exhaustive.
 *   - It exists to demonstrate the RETRIEVAL-AUGMENTED pattern (look up
 *     relevant context before reasoning) at minimal complexity -- no
 *     vector database, no embeddings service, just keyword matching
 *     against the `keywords` field of each entry (see
 *     lib/retrieval/match.ts for the matching logic).
 *   - There are 3 snippets per TPO category (9 total), each written so
 *     that it would plausibly be retrieved by at least one of the 6
 *     bundled sample records in public/samples/ -- this keeps the demo
 *     deterministic and easy to narrate live ("notice it pulled up the
 *     billing-rate-variance guideline for this claim").
 * -----------------------------------------------------------------------
 */

import type { ReferenceSnippet } from "@/types/review";

export const REFERENCE_SNIPPETS: ReferenceSnippet[] = [
  // ----------------------------------------------------------------
  // Payment category (3 snippets)
  // ----------------------------------------------------------------
  {
    id: "REF-PAY-01",
    category: "payment",
    title: "Billed Amount vs. Contracted Rate Variance",
    keywords: [
      "billed amount",
      "contracted",
      "allowed amount",
      "rate",
      "claim",
      "billing",
    ],
    text:
      "Claims should generally be reimbursed at or near the contracted " +
      "(allowed) rate for the billed procedure code. A billed amount " +
      "exceeding the regional contracted rate by a wide margin (for " +
      "example, more than double) is a recognized indicator of a " +
      "billing or coding error and warrants manual review before " +
      "payment.",
  },
  {
    id: "REF-PAY-02",
    category: "payment",
    title: "Diagnosis-Procedure Clinical Consistency",
    keywords: [
      "diagnosis code",
      "procedure code",
      "icd-10",
      "cpt",
      "mismatch",
      "claim",
    ],
    text:
      "The diagnosis code submitted on a claim should be clinically " +
      "consistent with the billed procedure code -- for example, a " +
      "minor respiratory diagnosis would not typically justify a major " +
      "surgical procedure. A mismatch between diagnosis and procedure " +
      "is a common signal of miscoding, upcoding, or billing error.",
  },
  {
    id: "REF-PAY-03",
    category: "payment",
    title: "Repeated High-Cost Procedure Pattern by Provider",
    keywords: [
      "provider",
      "pattern",
      "repeated",
      "claims",
      "90 days",
      "billing",
    ],
    text:
      "Multiple claims from the same provider billing the same " +
      "high-cost procedure code paired with a low-acuity diagnosis " +
      "code within a short time window (e.g., 90 days) should be " +
      "escalated for pattern-level review rather than evaluated only " +
      "as isolated, individual claims.",
  },

  // ----------------------------------------------------------------
  // Treatment category (3 snippets)
  // ----------------------------------------------------------------
  {
    id: "REF-TRT-01",
    category: "treatment",
    title: "Medication Refill Adherence Gap",
    keywords: [
      "medication",
      "refill",
      "adherence",
      "gap",
      "metformin",
      "days",
    ],
    text:
      "For chronic disease management medications, a refill gap " +
      "exceeding roughly 30 days is considered clinically significant " +
      "non-adherence. A gap of this size or larger should prompt a " +
      "documented care plan review, not simply continue unchanged.",
  },
  {
    id: "REF-TRT-02",
    category: "treatment",
    title: "Scheduled Lab Monitoring Completion",
    keywords: [
      "lab draws",
      "a1c",
      "scheduled",
      "completed",
      "monitoring",
      "quarterly",
    ],
    text:
      "Patients on a chronic disease management plan are expected to " +
      "complete all scheduled monitoring lab draws (for example, " +
      "quarterly A1C testing for diabetes management) on time. Missed " +
      "draws limit the care team's ability to assess whether the " +
      "treatment plan is working and should be treated as a gap in " +
      "care, not merely a scheduling inconvenience.",
  },
  {
    id: "REF-TRT-03",
    category: "treatment",
    title: "Worsening Clinical Marker Without Plan Adjustment",
    keywords: [
      "worsening",
      "trend",
      "a1c",
      "care plan",
      "adjustment",
      "follow-up",
    ],
    text:
      "A worsening trend in a key clinical marker (such as a rising " +
      "A1C value) that occurs without any corresponding adjustment to " +
      "the treatment plan or documented clinical follow-up is " +
      "considered a gap in care management requiring escalation.",
  },

  // ----------------------------------------------------------------
  // Operations category (3 snippets)
  // ----------------------------------------------------------------
  {
    id: "REF-OPS-01",
    category: "operations",
    title: "Nurse-to-Patient Staffing Ratio Threshold",
    keywords: [
      "nurse-to-patient",
      "ratio",
      "staffing",
      "census",
      "unit",
      "target range",
    ],
    text:
      "Nurse-to-patient ratios that exceed a unit's defined target " +
      "range (commonly 1:4 to 1:6 for general medical-surgical units) " +
      "are associated with an increased risk of adverse patient " +
      "events and should be flagged for operational review, " +
      "particularly when sustained across consecutive shifts.",
  },
  {
    id: "REF-OPS-02",
    category: "operations",
    title: "Overtime Hours Deviation from Baseline",
    keywords: [
      "overtime",
      "hours",
      "average",
      "baseline",
      "shift",
      "staffing",
    ],
    text:
      "Overtime hours that exceed roughly three times a unit's trailing " +
      "30-day average may indicate an unplanned staffing shortfall " +
      "rather than routine workload variation, and should be reviewed " +
      "alongside census and incident data for the same period.",
  },
  {
    id: "REF-OPS-03",
    category: "operations",
    title: "Incident Report Spike Correlated with Reduced Staffing",
    keywords: [
      "incident reports",
      "spike",
      "fall",
      "medication delay",
      "missed",
      "staffing",
    ],
    text:
      "A same-shift spike in incident reports (such as falls, " +
      "medication delays, or missed vital-sign checks) occurring " +
      "alongside a reduced nurse-to-patient ratio is a recognized risk " +
      "pattern in healthcare operations and warrants a combined " +
      "staffing-and-safety review rather than treating each incident " +
      "in isolation.",
  },
];
