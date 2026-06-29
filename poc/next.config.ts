import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* No custom configuration needed. An earlier version of this file
     listed `pdf-parse`/`pdfjs-dist` under `serverExternalPackages` to
     work around a worker-bundling issue with that library -- see
     lib/parsing/extract-text.ts for why we switched to `unpdf` instead,
     which is built specifically to bundle cleanly in serverless/edge
     environments with no special configuration required. */
};

export default nextConfig;
