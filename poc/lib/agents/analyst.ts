/*
 * lib/agents/analyst.ts
 * -----------------------------------------------------------------------
 * The Analyst agent: the FIRST of the two agents in the review pipeline.
 *
 * Role in the pipeline: given a record's text and the reference snippets
 * retrieved for it (see lib/retrieval/match.ts), the Analyst reasons
 * step-by-step about whether the record looks anomalous, and produces a
 * first-pass decision. This output is always reviewed by the Auditor
 * agent afterward (lib/agents/auditor.ts) -- the Analyst's decision is
 * never treated as final on its own. See
 * context/POC_Design_Decisions.md, section "Agent Architecture", in the
 * parent project for the full rationale behind this two-agent pattern.
 *
 * OUTPUT SHAPE: the Analyst returns a short summary plus 3-6 bullet
 * points (StructuredFinding), not one long prose paragraph. This is a
 * deliberate UI decision -- the intended audience (insurance/medical
 * reviewers) needs to scan a decision quickly, not read a paragraph.
 * -----------------------------------------------------------------------
 */

import { askClaude } from "@/lib/claude-client";
import { parseAgentJsonResponse } from "./parse-json-response";
import type {
  AnalystOutput,
  CertaintyLevel,
  Decision,
  ReferenceSnippet,
} from "@/types/review";

/**
 * The Analyst's system prompt: defines its role, what inputs it will
 * receive, how it should reason, and the EXACT JSON shape it must
 * respond with. Asking for strict JSON (rather than free-form prose) is
 * what lets the rest of the pipeline -- the Auditor agent and the UI --
 * treat the Analyst's output as a reliable, typed data structure instead
 * of text that needs further interpretation.
 */
const ANALYST_SYSTEM_PROMPT = `You are the Analyst agent in a two-agent record-review pipeline used to evaluate short healthcare-related records spanning Treatment, Payment, and Operations (TPO) categories. Your audience is insurance and medical reviewers who need to scan your output quickly, not read a paragraph.

You will be given:
1. The text of one uploaded record.
2. Zero or more retrieved reference guideline snippets (each with an ID), which may or may not be relevant to this specific record.

Your job: read the record carefully and reason step by step about whether it looks anomalous (contains an error, inconsistency, or a pattern of concern) or appears to be a normal, "clear" record. Ground your reasoning in the retrieved reference snippets where they are genuinely relevant, and explicitly cite the IDs of any snippets your reasoning actually relies on. If none of the retrieved snippets are relevant to this record, say so and decide based on the record's own merits.

Respond with ONLY a single JSON object and nothing else -- no markdown code fences, no commentary before or after the JSON. The object must have exactly these fields:
{
  "decision": "flagged" or "clear",
  "certainty": "low", "medium", or "high",
  "summary": "one single sentence capturing your overall takeaway",
  "keyPoints": an array of 3 to 6 short bullet-point strings (each one independent sentence, no more than ~20 words) that together support your decision -- write these to be scanned at a glance, not read as a paragraph,
  "citedSnippetIds": an array of snippet ID strings you actually relied on, or an empty array if none applied
}`;

function buildUserMessage(
  recordText: string,
  retrievedSnippets: ReferenceSnippet[],
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
  ].join("\n");
}

/** Closed sets used to validate the model's response below, mirroring
 *  the string-union types in types/review.ts. Declared as runtime
 *  arrays (TypeScript types don't exist at runtime) so we can check an
 *  arbitrary parsed JSON value against them before trusting it. */
const VALID_DECISIONS: Decision[] = ["flagged", "clear"];
const VALID_CERTAINTY_LEVELS: CertaintyLevel[] = ["low", "medium", "high"];

/**
 * Validates that a parsed JSON value actually has the shape of
 * AnalystOutput before we trust it. LLM output is not guaranteed to
 * conform to the requested schema even with a clear prompt, so this
 * defensive check turns a malformed response into a clear, specific
 * error instead of letting bad data silently flow into the Auditor
 * agent or the UI.
 */
function validateAnalystOutput(value: unknown): AnalystOutput {
  if (typeof value !== "object" || value === null) {
    throw new Error("Analyst response was not a JSON object.");
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.decision !== "string" ||
    !VALID_DECISIONS.includes(candidate.decision as Decision)
  ) {
    throw new Error(
      `Analyst response had an invalid "decision" field: ${JSON.stringify(candidate.decision)}`,
    );
  }

  if (
    typeof candidate.certainty !== "string" ||
    !VALID_CERTAINTY_LEVELS.includes(candidate.certainty as CertaintyLevel)
  ) {
    throw new Error(
      `Analyst response had an invalid "certainty" field: ${JSON.stringify(candidate.certainty)}`,
    );
  }

  if (typeof candidate.summary !== "string" || candidate.summary.length === 0) {
    throw new Error('Analyst response had a missing or empty "summary" field.');
  }

  if (
    !Array.isArray(candidate.keyPoints) ||
    candidate.keyPoints.length === 0 ||
    !candidate.keyPoints.every((point) => typeof point === "string" && point.length > 0)
  ) {
    throw new Error('Analyst response had an invalid or empty "keyPoints" field.');
  }

  if (
    !Array.isArray(candidate.citedSnippetIds) ||
    !candidate.citedSnippetIds.every((id) => typeof id === "string")
  ) {
    throw new Error('Analyst response had an invalid "citedSnippetIds" field.');
  }

  return {
    decision: candidate.decision as Decision,
    certainty: candidate.certainty as CertaintyLevel,
    findings: {
      summary: candidate.summary,
      keyPoints: candidate.keyPoints as string[],
    },
    citedSnippetIds: candidate.citedSnippetIds as string[],
  };
}

/**
 * Validates that a parsed JSON value has the shape of an already-built
 * AnalystOutput (i.e. the NESTED `findings: { summary, keyPoints }`
 * shape -- the public type in types/review.ts), as opposed to
 * validateAnalystOutput() above, which validates the FLAT shape Claude
 * itself returns before that nesting is applied.
 *
 * This is exported specifically for app/api/review/auditor/route.ts to
 * use on the `analyst` field of its incoming request body: that field
 * is an AnalystOutput serialized back over the wire by our own
 * app/page.tsx after a successful /api/review/analyst call, not a raw
 * Claude response -- so it needs this nested-shape check, not the
 * flat one. Without this, a malformed `analyst` field (object-shaped,
 * but missing `findings`) would crash with a raw, unfriendly
 * "Cannot read properties of undefined" TypeError deep inside
 * lib/agents/auditor.ts's prompt-building code instead of a clear,
 * specific validation error returned right at the API boundary.
 */
export function validateAnalystOutputShape(value: unknown): AnalystOutput {
  if (typeof value !== "object" || value === null) {
    throw new Error('Expected "analyst" to be an object.');
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.decision !== "string" ||
    !VALID_DECISIONS.includes(candidate.decision as Decision)
  ) {
    throw new Error(
      `"analyst.decision" is invalid: ${JSON.stringify(candidate.decision)}`,
    );
  }

  if (
    typeof candidate.certainty !== "string" ||
    !VALID_CERTAINTY_LEVELS.includes(candidate.certainty as CertaintyLevel)
  ) {
    throw new Error(
      `"analyst.certainty" is invalid: ${JSON.stringify(candidate.certainty)}`,
    );
  }

  const findings = candidate.findings;
  if (typeof findings !== "object" || findings === null) {
    throw new Error('Expected "analyst.findings" to be an object.');
  }
  const findingsCandidate = findings as Record<string, unknown>;

  if (
    typeof findingsCandidate.summary !== "string" ||
    findingsCandidate.summary.length === 0
  ) {
    throw new Error('Expected "analyst.findings.summary" to be a non-empty string.');
  }

  if (
    !Array.isArray(findingsCandidate.keyPoints) ||
    findingsCandidate.keyPoints.length === 0 ||
    !findingsCandidate.keyPoints.every((point) => typeof point === "string" && point.length > 0)
  ) {
    throw new Error('Expected "analyst.findings.keyPoints" to be a non-empty array of strings.');
  }

  if (
    !Array.isArray(candidate.citedSnippetIds) ||
    !candidate.citedSnippetIds.every((id) => typeof id === "string")
  ) {
    throw new Error('Expected "analyst.citedSnippetIds" to be an array of strings.');
  }

  return {
    decision: candidate.decision as Decision,
    certainty: candidate.certainty as CertaintyLevel,
    findings: {
      summary: findingsCandidate.summary,
      keyPoints: findingsCandidate.keyPoints as string[],
    },
    citedSnippetIds: candidate.citedSnippetIds as string[],
  };
}

/**
 * Runs the Analyst agent: sends the record + retrieved snippets to
 * Claude using ANALYST_SYSTEM_PROMPT, parses the response as JSON, and
 * validates it into a typed AnalystOutput.
 */
export async function runAnalyst(
  recordText: string,
  retrievedSnippets: ReferenceSnippet[],
): Promise<AnalystOutput> {
  const userMessage = buildUserMessage(recordText, retrievedSnippets);
  const rawResponse = await askClaude(ANALYST_SYSTEM_PROMPT, userMessage);
  const parsed = parseAgentJsonResponse<unknown>(rawResponse);
  return validateAnalystOutput(parsed);
}
