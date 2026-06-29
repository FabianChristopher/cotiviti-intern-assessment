/*
 * app/api/review/auditor/route.ts
 * -----------------------------------------------------------------------
 * Stage 3 (final) of the review pipeline: run the Auditor agent over the
 * record text, the retrieved snippets, and the Analyst's output from
 * stage 2 (app/api/review/analyst/route.ts).
 *
 * Like the Analyst route, this is a genuine, separate network request so
 * its loading duration in the UI reflects the real latency of its own
 * Claude API call. The client (app/page.tsx) calls this only after
 * stage 2 has returned, since the Auditor genuinely depends on the
 * Analyst's output.
 * -----------------------------------------------------------------------
 */

import { NextResponse } from "next/server";
import { validateAnalystOutputShape } from "@/lib/agents/analyst";
import { runAuditor } from "@/lib/agents/auditor";
import type { AnalystOutput, AuditorOutput, ReferenceSnippet } from "@/types/review";

export const dynamic = "force-dynamic";

interface AuditorRequestBody {
  recordText?: unknown;
  retrievedSnippets?: unknown;
  analyst?: unknown;
}

/** Shape validation for the incoming JSON body. `recordText` and
 *  `retrievedSnippets` get only a shallow check (they were produced by
 *  our own /retrieve endpoint moments earlier, not arbitrary external
 *  input), but `analyst` gets the full validateAnalystOutputShape()
 *  check -- it is the one field whose nested structure
 *  (`findings.summary`, `findings.keyPoints`) is actually read while
 *  building the Auditor's prompt (lib/agents/auditor.ts), so a
 *  malformed value there needs to fail clearly, right here, rather
 *  than crashing deep inside prompt-building with a raw "Cannot read
 *  properties of undefined" error. */
function parseRequestBody(body: AuditorRequestBody): {
  recordText: string;
  retrievedSnippets: ReferenceSnippet[];
  analyst: AnalystOutput;
} {
  if (typeof body.recordText !== "string" || body.recordText.length === 0) {
    throw new Error('Expected a non-empty "recordText" string field.');
  }
  if (!Array.isArray(body.retrievedSnippets)) {
    throw new Error('Expected a "retrievedSnippets" array field.');
  }
  return {
    recordText: body.recordText,
    retrievedSnippets: body.retrievedSnippets as ReferenceSnippet[],
    analyst: validateAnalystOutputShape(body.analyst),
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let recordText: string;
  let retrievedSnippets: ReferenceSnippet[];
  let analyst: AnalystOutput;

  try {
    const body = (await request.json()) as AuditorRequestBody;
    ({ recordText, retrievedSnippets, analyst } = parseRequestBody(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const auditor: AuditorOutput = await runAuditor(recordText, retrievedSnippets, analyst);
    return NextResponse.json({ auditor }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The Auditor agent failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
