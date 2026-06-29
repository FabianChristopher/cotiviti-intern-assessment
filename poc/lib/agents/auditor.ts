/*
 * lib/agents/auditor.ts
 * -----------------------------------------------------------------------
 * The Auditor agent: the SECOND of the two agents in the review
 * pipeline, and the one whose output is the pipeline's authoritative
 * final verdict.
 *
 * Role in the pipeline: given the same record text and retrieved
 * snippets the Analyst saw, PLUS the Analyst's full first-pass output,
 * the Auditor independently and critically reviews that decision --
 * actively looking for gaps, overreach, or misapplied reference
 * snippets -- and either confirms or overturns it. This "generator then
 * critic" pattern is the core agentic-reasoning concept this proof of
 * concept demonstrates; see context/POC_Design_Decisions.md, section
 * "Agent Architecture", in the parent project for the full rationale.
 *
 * IMPORTANT: there is deliberately no loop back to the Analyst. If the
 * Auditor overturns the Analyst, that overturned result IS the final
 * answer -- we do not send it back for a third round. This keeps the
 * pipeline simple, deterministic, and easy to narrate live.
 *
 * OUTPUT SHAPE: like the Analyst, the Auditor returns a short summary
 * plus 3-6 bullet points (StructuredFinding) rather than one prose
 * paragraph -- see lib/agents/analyst.ts for the same rationale.
 * -----------------------------------------------------------------------
 */

import { askClaude } from "@/lib/claude-client";
import { parseAgentJsonResponse } from "./parse-json-response";
import type {
  AnalystOutput,
  AuditorOutput,
  CertaintyLevel,
  Decision,
  ReferenceSnippet,
} from "@/types/review";

const AUDITOR_SYSTEM_PROMPT = `You are the Auditor agent in a two-agent record-review pipeline. The Analyst agent has already produced a first-pass decision about a record. Your job is to independently and critically review that decision and decide whether to confirm or overturn it. Your audience is insurance and medical reviewers who need to scan your output quickly, not read a paragraph.

You will be given:
1. The original record text.
2. The same retrieved reference guideline snippets the Analyst saw.
3. The Analyst's full output: its decision, certainty, summary, key points, and which snippet IDs it cited.

Be a genuine second check, not a rubber stamp. Actively look for places where the Analyst's reasoning might be wrong, incomplete, overreaching, or unsupported by the record or the cited snippets. You should overturn the Analyst's decision if your independent review finds it unjustified, and you should confirm it if your review finds it sound -- either outcome is a valid and expected result of a careful audit.

Respond with ONLY a single JSON object and nothing else -- no markdown code fences, no commentary before or after the JSON. The object must have exactly these fields:
{
  "agreement": "confirmed" or "overturned",
  "finalDecision": "flagged" or "clear",
  "certainty": "low", "medium", or "high",
  "summary": "one single sentence capturing your overall takeaway as the auditor",
  "keyPoints": an array of 3 to 6 short bullet-point strings (each one independent sentence, no more than ~20 words) explaining your audit findings -- write these to be scanned at a glance, not read as a paragraph,
  "citedSnippetIds": an array of snippet ID strings you relied on in your own review, or an empty array if none applied
}`;

function buildUserMessage(
  recordText: string,
  retrievedSnippets: ReferenceSnippet[],
  analystOutput: AnalystOutput,
): string {
  const snippetsSection =
    retrievedSnippets.length === 0
      ? "No reference snippets were retrieved for this record."
      : retrievedSnippets
          .map((snippet) => `[${snippet.id}] ${snippet.title}\n${snippet.text}`)
          .join("\n\n");

  return [
    "RECORD TEXT:",
    recordText,
    "",
    "RETRIEVED REFERENCE SNIPPETS:",
    snippetsSection,
    "",
    "ANALYST'S FIRST-PASS OUTPUT:",
    `Decision: ${analystOutput.decision}`,
    `Certainty: ${analystOutput.certainty}`,
    `Summary: ${analystOutput.findings.summary}`,
    `Key points: ${analystOutput.findings.keyPoints.join(" | ")}`,
    `Cited snippet IDs: ${analystOutput.citedSnippetIds.join(", ") || "(none)"}`,
  ].join("\n");
}

const VALID_AGREEMENTS: AuditorOutput["agreement"][] = ["confirmed", "overturned"];
const VALID_DECISIONS: Decision[] = ["flagged", "clear"];
const VALID_CERTAINTY_LEVELS: CertaintyLevel[] = ["low", "medium", "high"];

/**
 * Validates that a parsed JSON value actually has the shape of
 * AuditorOutput before we trust it -- this is the pipeline's FINAL
 * output, so it is especially important to fail loudly and clearly
 * rather than let malformed data reach the UI.
 */
function validateAuditorOutput(value: unknown): AuditorOutput {
  if (typeof value !== "object" || value === null) {
    throw new Error("Auditor response was not a JSON object.");
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.agreement !== "string" ||
    !VALID_AGREEMENTS.includes(candidate.agreement as AuditorOutput["agreement"])
  ) {
    throw new Error(
      `Auditor response had an invalid "agreement" field: ${JSON.stringify(candidate.agreement)}`,
    );
  }

  if (
    typeof candidate.finalDecision !== "string" ||
    !VALID_DECISIONS.includes(candidate.finalDecision as Decision)
  ) {
    throw new Error(
      `Auditor response had an invalid "finalDecision" field: ${JSON.stringify(candidate.finalDecision)}`,
    );
  }

  if (
    typeof candidate.certainty !== "string" ||
    !VALID_CERTAINTY_LEVELS.includes(candidate.certainty as CertaintyLevel)
  ) {
    throw new Error(
      `Auditor response had an invalid "certainty" field: ${JSON.stringify(candidate.certainty)}`,
    );
  }

  if (typeof candidate.summary !== "string" || candidate.summary.length === 0) {
    throw new Error('Auditor response had a missing or empty "summary" field.');
  }

  if (
    !Array.isArray(candidate.keyPoints) ||
    candidate.keyPoints.length === 0 ||
    !candidate.keyPoints.every((point) => typeof point === "string" && point.length > 0)
  ) {
    throw new Error('Auditor response had an invalid or empty "keyPoints" field.');
  }

  if (
    !Array.isArray(candidate.citedSnippetIds) ||
    !candidate.citedSnippetIds.every((id) => typeof id === "string")
  ) {
    throw new Error('Auditor response had an invalid "citedSnippetIds" field.');
  }

  return {
    agreement: candidate.agreement as AuditorOutput["agreement"],
    finalDecision: candidate.finalDecision as Decision,
    certainty: candidate.certainty as CertaintyLevel,
    findings: {
      summary: candidate.summary,
      keyPoints: candidate.keyPoints as string[],
    },
    citedSnippetIds: candidate.citedSnippetIds as string[],
  };
}

/**
 * Runs the Auditor agent: sends the record, retrieved snippets, and the
 * Analyst's output to Claude using AUDITOR_SYSTEM_PROMPT, parses the
 * response as JSON, and validates it into a typed AuditorOutput -- the
 * pipeline's final, authoritative result.
 */
export async function runAuditor(
  recordText: string,
  retrievedSnippets: ReferenceSnippet[],
  analystOutput: AnalystOutput,
): Promise<AuditorOutput> {
  const userMessage = buildUserMessage(recordText, retrievedSnippets, analystOutput);
  const rawResponse = await askClaude(AUDITOR_SYSTEM_PROMPT, userMessage);
  const parsed = parseAgentJsonResponse<unknown>(rawResponse);
  return validateAuditorOutput(parsed);
}
