/*
 * app/api/review/retrieve/route.ts
 * -----------------------------------------------------------------------
 * Stage 1 of the review pipeline: extract the uploaded/pasted record's
 * plain text, then run the lightweight keyword-matching retrieval step
 * against the static reference snippet library.
 *
 * THIS STAGE INVOLVES NO LLM CALL. It is pure file-text extraction (see
 * lib/parsing/extract-text.ts) plus in-memory keyword matching (see
 * lib/retrieval/match.ts), so it genuinely completes in well under a
 * second. Splitting this into its own endpoint -- rather than folding
 * it into the Analyst call, as an earlier version of this app did --
 * means the UI can show a real, honestly-fast "Retrieval" step instead
 * of a step whose loading state is artificially stretched to match how
 * long the Analyst's LLM call takes.
 *
 * Accepts the same two request shapes as before: multipart/form-data
 * with a "file" field (the primary path), or application/json with a
 * "text" field (the free-text paste fallback).
 * -----------------------------------------------------------------------
 */

import { NextResponse } from "next/server";
import { extractTextFromFile, UnsupportedFileTypeError } from "@/lib/parsing/extract-text";
import { retrieveRelevantSnippets } from "@/lib/retrieval/match";
import type { RetrievalResult } from "@/types/review";

// Always a fresh extraction/match for whatever was just uploaded -- never
// served from a cache.
export const dynamic = "force-dynamic";

async function extractRecordTextFromRequest(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error('Expected a "file" field in the uploaded form data.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractTextFromFile(file.name, buffer);

    // A user-uploaded file (unlike our 6 verified bundled samples) might
    // be empty, or a PDF with no actual text layer (e.g. a scanned
    // image -- which this app explicitly does not OCR, see
    // lib/parsing/extract-text.ts). Catching that here, at the exact
    // point the problem originates, gives a clear, specific message
    // instead of letting an empty string silently flow downstream to
    // the Analyst route, where it would instead fail with a generic
    // "missing recordText field" validation error that looks like an
    // API plumbing bug rather than what it actually is: an unreadable
    // file.
    if (extractedText.trim().length === 0) {
      throw new Error(
        "This file appears to contain no readable text. If it's a scanned/image-based PDF, note that this demo does not perform OCR -- try a text-based file instead.",
      );
    }

    return extractedText;
  }

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { text?: unknown };

    if (typeof body.text !== "string" || body.text.trim().length === 0) {
      throw new Error('Expected a non-empty "text" field in the JSON body.');
    }

    return body.text;
  }

  throw new Error(
    `Unsupported Content-Type "${contentType}". Expected multipart/form-data (file upload) or application/json (pasted text).`,
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let recordText: string;

  try {
    recordText = await extractRecordTextFromRequest(request);
  } catch (error) {
    const status = error instanceof UnsupportedFileTypeError ? 415 : 400;
    const message = error instanceof Error ? error.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status });
  }

  const retrievedSnippets = retrieveRelevantSnippets(recordText);

  const result: RetrievalResult = { recordText, retrievedSnippets };
  return NextResponse.json(result, { status: 200 });
}
