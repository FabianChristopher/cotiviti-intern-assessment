/*
 * lib/parsing/extract-text.ts
 * -----------------------------------------------------------------------
 * Converts an uploaded record file into plain text that can be handed to
 * the Analyst/Auditor agents.
 *
 * SCOPE -- what this deliberately does and does NOT support:
 *   - Supports .txt and .csv (read directly as UTF-8 text) and .pdf
 *     (text extracted via the `unpdf` library).
 *   - Does NOT support OCR or scanned/image-based PDFs. This works only
 *     because the bundled sample PDFs (public/samples/*.pdf) are
 *     text-based documents we generated ourselves, not scanned images.
 *     Real-world scanned-document support would require a computer-
 *     vision/OCR pipeline, which is explicitly out of scope for this
 *     proof of concept -- see context/POC_Design_Decisions.md, section
 *     "Why Not the Alternatives" in the parent project, for the
 *     reasoning (OCR support belongs to a different assessment topic
 *     than the one this demo targets).
 *
 * LIBRARY CHOICE NOTE: this originally used `pdf-parse`, which depends
 * on `pdfjs-dist`, which in turn has an OPTIONAL native dependency on
 * `@napi-rs/canvas` for page-rendering support we never use (we only
 * ever extract text, never render a page as an image). That optional
 * native binary is platform-specific -- it worked fine in local
 * development on macOS, but the production deployment (Vercel's Linux
 * serverless runtime) didn't have a matching binary available, which
 * crashed the ENTIRE route at module-load time with "ReferenceError:
 * DOMMatrix is not defined" -- for every request, including ones that
 * never touched a PDF at all. Switched to `unpdf`, which has zero
 * dependencies and is purpose-built for serverless/edge runtimes
 * (Vercel, Cloudflare Workers) with no native bindings of any kind.
 * -----------------------------------------------------------------------
 */

import { extractText as extractPdfText } from "unpdf";

/** File extensions this module knows how to handle, lowercase and
 *  without the leading dot. Used both for validation and for routing to
 *  the correct extraction strategy below. */
const SUPPORTED_EXTENSIONS = ["txt", "csv", "pdf"] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** Thrown when a caller uploads a file type this module cannot process.
 *  Kept as a distinct, named error (rather than a generic Error) so the
 *  API route can catch it specifically and return a clear, user-facing
 *  message instead of a generic 500. */
export class UnsupportedFileTypeError extends Error {
  constructor(extension: string) {
    super(
      `Unsupported file type ".${extension}". Supported types are: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
    );
    this.name = "UnsupportedFileTypeError";
  }
}

/** Extracts the lowercase file extension (without the dot) from a
 *  filename, e.g. "claim-002-flagged.PDF" -> "pdf". Returns an empty
 *  string if the filename has no extension. */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/** Type guard narrowing a plain string extension down to one of our
 *  known SupportedExtension values, so the switch statement below is
 *  exhaustively checked by the compiler. */
function isSupportedExtension(
  extension: string,
): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Extracts plain text from a .pdf file's raw bytes using `unpdf`.
 * `mergePages: true` collapses every page into a single string -- our
 * sample/uploaded records are always short, single-purpose documents,
 * so there is no need to keep page boundaries separate.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const { text } = await extractPdfText(data, { mergePages: true });
  return text;
}

/**
 * Extracts plain text from a .txt or .csv file's raw bytes. Both are
 * treated identically here: read as UTF-8 text. (We are not attempting
 * to parse CSV into rows/columns -- the Analyst agent reads the raw
 * delimited text directly, which is sufficient for a single small
 * record per upload.)
 */
function extractTextFromPlainText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * Main entry point: given a filename (used only to determine file type)
 * and the file's raw bytes, returns the extracted plain-text content.
 *
 * Throws UnsupportedFileTypeError if the filename's extension is not one
 * of SUPPORTED_EXTENSIONS.
 */
export async function extractTextFromFile(
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const extension = getExtension(filename);

  if (!isSupportedExtension(extension)) {
    throw new UnsupportedFileTypeError(extension);
  }

  switch (extension) {
    case "pdf":
      return extractTextFromPdf(buffer);
    case "txt":
    case "csv":
      return extractTextFromPlainText(buffer);
  }
}
