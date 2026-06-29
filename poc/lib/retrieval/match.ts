/*
 * lib/retrieval/match.ts
 * -----------------------------------------------------------------------
 * The retrieval step of the pipeline: given a record's raw text, find the
 * most relevant entries from the static REFERENCE_SNIPPETS library
 * (lib/retrieval/snippets.ts).
 *
 * DELIBERATE DESIGN CHOICE: this uses simple, transparent keyword-overlap
 * scoring -- NOT a vector database, NOT an embeddings API call. With only
 * 9 static snippets, a full semantic-search/embeddings pipeline would add
 * real complexity (an external service call, similarity math, index
 * management) without changing what the demo proves. Keyword overlap is
 * easy to read, easy to explain on camera, and sufficient at this scale.
 * See context/POC_Design_Decisions.md, section "Why Not the
 * Alternatives", in the parent project for the full comparison.
 * -----------------------------------------------------------------------
 */

import type { ReferenceSnippet } from "@/types/review";
import { REFERENCE_SNIPPETS } from "./snippets";

/** How many top-scoring snippets to return per record. Kept small (3) so
 *  the agents' prompts stay short and the UI doesn't get cluttered with
 *  marginally-relevant references. */
const MAX_RESULTS = 3;

/**
 * Normalizes text for comparison: lowercases it and collapses all
 * whitespace/punctuation runs down to single spaces. Doing this once,
 * consistently, for both the record text and the snippet keywords avoids
 * subtle bugs where "A1C," (with a trailing comma) fails to match the
 * keyword "a1c" purely because of punctuation.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Scores a single reference snippet against the normalized record text
 * by counting how many of the snippet's keywords/phrases appear as a
 * substring of the record. Multi-word keywords (e.g. "nurse-to-patient")
 * are normalized the same way as the record text, so phrase matches are
 * still found even though we are not doing any tokenization beyond
 * simple substring search.
 *
 * Returns a plain integer "hit count" -- there is no need for a more
 * elaborate scoring formula (TF-IDF, cosine similarity, etc.) at this
 * scale; the top few snippets by raw keyword-hit count are sufficient to
 * ground the agents' reasoning.
 */
function scoreSnippet(
  normalizedRecordText: string,
  snippet: ReferenceSnippet,
): number {
  let hits = 0;
  for (const keyword of snippet.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedKeyword.length > 0 && normalizedRecordText.includes(normalizedKeyword)) {
      hits += 1;
    }
  }
  return hits;
}

/**
 * Public entry point for the retrieval step. Given the raw text of an
 * uploaded/pasted record, returns the top-matching reference snippets
 * (highest keyword-hit count first), capped at MAX_RESULTS.
 *
 * If nothing scores above zero (the record text doesn't share any
 * keywords with our small reference library), an empty array is
 * returned -- the Analyst agent's prompt is written to handle this
 * gracefully rather than assuming retrieval always succeeds.
 */
export function retrieveRelevantSnippets(
  recordText: string,
): ReferenceSnippet[] {
  const normalizedRecordText = normalize(recordText);

  const scored = REFERENCE_SNIPPETS.map((snippet) => ({
    snippet,
    score: scoreSnippet(normalizedRecordText, snippet),
  }));

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.snippet);
}
