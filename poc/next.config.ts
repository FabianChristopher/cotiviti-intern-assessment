import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * pdf-parse (used in lib/parsing/extract-text.ts) depends on
   * pdfjs-dist, which loads a separate "worker" script file at runtime
   * to do the actual PDF parsing off the main thread. Turbopack's
   * server bundler does not carry that worker file along when it
   * bundles our API route, which causes a "Cannot find module
   * .../pdf.worker.mjs" error the first time a PDF is uploaded.
   *
   * Listing these packages here tells Next.js to leave them
   * un-bundled on the server and resolve them with normal Node.js
   * module resolution instead -- which correctly finds the worker file
   * inside node_modules at runtime. This is the standard fix for any
   * dependency (native bindings, worker scripts, etc.) that doesn't
   * tolerate being bundled.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
