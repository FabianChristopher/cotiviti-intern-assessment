/*
 * lib/claude-client.ts
 * -----------------------------------------------------------------------
 * Thin wrapper around the Anthropic SDK, shared by both the Analyst and
 * Auditor agents (lib/agents/analyst.ts, lib/agents/auditor.ts).
 *
 * WHY THIS WRAPPER EXISTS (rather than each agent calling the SDK
 * directly): it gives us exactly one place that:
 *   1. Reads the API key from the environment and fails with a clear,
 *      actionable error message if it is missing, instead of letting a
 *      confusing SDK-level authentication error surface deep in an
 *      agent's logic.
 *   2. Centralizes the model name and default request parameters
 *      (temperature, max tokens) so both agents stay consistent and a
 *      future model upgrade is a one-line change.
 *   3. Defines a single `askClaude` helper with a simple, agent-agnostic
 *      signature (system prompt + user message in, plain text out) that
 *      both agents can call without duplicating SDK boilerplate.
 * -----------------------------------------------------------------------
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * The Claude model used by both agents. Centralized here so upgrading
 * models later does not require touching agent logic.
 */
const MODEL_NAME = "claude-sonnet-4-6";

/**
 * Maximum tokens either agent is allowed to generate per call. The
 * requested JSON shape (a summary sentence plus up to 6 key-point
 * bullets, each up to ~20 words, per types/review.ts's
 * StructuredFinding) can run to several hundred words on a verbose
 * response -- 1536 leaves comfortable headroom above that so a
 * detailed response cannot get cut off mid-JSON (which would otherwise
 * surface as a confusing "failed to parse agent response" error
 * instead of a clean result), while still being far short of "run away
 * in cost or latency" territory for a single call.
 */
const MAX_OUTPUT_TOKENS = 1536;

/**
 * Lazily-constructed singleton Anthropic client. We don't construct this
 * at module load time because that would throw immediately if
 * ANTHROPIC_API_KEY is missing, even for code paths (like running the
 * Next.js dev server before .env.local is configured) that haven't
 * actually tried to call Claude yet. Constructing it lazily, inside
 * `getClient()`, means the clear error below only fires when an agent
 * actually attempts a request.
 */
let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.local.example to " +
        ".env.local and fill in a real key (see README.md).",
    );
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/**
 * Sends a single-turn request to Claude: one system prompt (the agent's
 * role/instructions) plus one user message (the record + retrieved
 * context), and returns the model's reply as plain text.
 *
 * This function intentionally has no knowledge of "Analyst" or
 * "Auditor" -- it is a generic single-turn text completion helper. The
 * agent-specific prompt construction and response parsing live in
 * lib/agents/, not here, keeping this wrapper reusable and simple.
 */
export async function askClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // The SDK returns an array of content blocks (to support cases like
  // tool use or multi-part responses). For our simple single-turn text
  // completion use case, we only ever expect one "text" block, but we
  // defensively filter for it rather than assuming `content[0]` is
  // always the right shape.
  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock || textBlock.type !== "text") {
    throw new Error(
      "Claude response did not contain a text block as expected.",
    );
  }

  return textBlock.text;
}
