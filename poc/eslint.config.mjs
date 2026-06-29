import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // scripts/ contains one-off, manually-run Node content-authoring
    // utilities (e.g. generating the bundled sample PDFs) -- these are
    // plain CommonJS scripts, not part of the Next.js application
    // source, and are intentionally exempt from the app's lint rules
    // (e.g. @typescript-eslint/no-require-imports, which correctly
    // applies to application code but not to a .cjs script that is
    // meant to use require()).
    "scripts/**",
  ]),
]);

export default eslintConfig;
