/*
 * lib/agents/parse-json-response.ts
 * -----------------------------------------------------------------------
 * Shared helper for turning a Claude text response into a parsed JSON
 * object, used by both lib/agents/analyst.ts and lib/agents/auditor.ts.
 *
 * Both agents are instructed (via their system prompts) to respond with
 * ONLY a single JSON object and nothing else. In practice, models
 * sometimes wrap JSON output in a markdown code fence (```json ... ```)
 * even when explicitly told not to, so this helper defensively strips
 * that wrapping before attempting to parse, rather than assuming the
 * raw text is always already valid JSON.
 * -----------------------------------------------------------------------
 */

/** How much of the raw response to include in the error message below.
 *  This message ultimately surfaces all the way up to the UI's error
 *  banner (see app/page.tsx's `errorMessage` state) -- embedding the
 *  full raw response there, which could be over a thousand characters
 *  for a verbose model reply, would flood that banner with an
 *  unreadable wall of text instead of a short, scannable message. */
const RAW_RESPONSE_PREVIEW_LENGTH = 300;

/** Thrown when a model's response cannot be parsed as JSON after
 *  stripping any markdown code-fence wrapping. Kept as a distinct,
 *  named error so callers can catch it specifically and surface a clear
 *  "the agent returned malformed output" message rather than a generic
 *  JSON.parse SyntaxError. The full, untruncated raw response is still
 *  available via `cause` for server-side debugging if needed. */
export class AgentResponseParseError extends Error {
  constructor(rawResponse: string, cause: unknown) {
    const preview =
      rawResponse.length > RAW_RESPONSE_PREVIEW_LENGTH
        ? `${rawResponse.slice(0, RAW_RESPONSE_PREVIEW_LENGTH)}…`
        : rawResponse;
    super(`Failed to parse agent response as JSON. Response began with: ${preview}`);
    this.name = "AgentResponseParseError";
    this.cause = cause;
  }
}

/**
 * Strips a leading/trailing markdown code fence (with or without a
 * "json" language tag) from a string, if present. If no fence is
 * present, the input is returned unchanged (trimmed).
 */
function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Parses a raw Claude text response into a JSON value of the expected
 * shape `T`. This function does NOT validate that the parsed object
 * actually matches `T` at runtime -- each agent module is responsible
 * for validating the specific fields it expects immediately after
 * calling this (see analyst.ts / auditor.ts for those checks). This
 * function's only job is "turn this string into *some* parsed JSON
 * value, robustly."
 */
export function parseAgentJsonResponse<T>(rawResponse: string): T {
  const cleaned = stripMarkdownCodeFence(rawResponse);

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    throw new AgentResponseParseError(rawResponse, error);
  }
}
