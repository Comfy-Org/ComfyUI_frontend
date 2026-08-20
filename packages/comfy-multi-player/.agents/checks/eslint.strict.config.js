/**
 * Strict ESLint config for the sonarjs-lint review check.
 *
 * Uses eslint-plugin-sonarjs for SonarQube-grade analysis without a server.
 * This config is NOT the package's development lint config — it is only used by
 * the code-review checks' static-analysis pass.
 *
 * Setup + run (install transiently so the config's bare imports resolve, without
 * touching package.json; the pure yjs-only production dep set is unaffected):
 *   npm i --no-save eslint eslint-plugin-sonarjs @typescript-eslint/parser
 *   npx eslint --no-config-lookup --config .agents/checks/eslint.strict.config.js \
 *     --format json {files}
 *
 * Notes:
 * - This package's src/** is TypeScript, so a TypeScript-aware parser is
 *   required; the default JS parser fails on .ts syntax. Syntax-only parsing
 *   (no type-check program) is enough for the SonarJS rules.
 * - We build on `sonarjs.configs.recommended` (the plugin's currently-valid rule
 *   set) instead of hand-listing individual rules, which drift across plugin
 *   majors (e.g. several v0/v1 rule IDs were renamed/removed by v4). The only
 *   override is a stricter cognitive-complexity threshold.
 */

import sonarjs from "eslint-plugin-sonarjs";
import tsParser from "@typescript-eslint/parser";

export default [
  // recommended already registers the `sonarjs` plugin and enables its rules;
  // do not redefine the plugin key (ESLint flat config forbids it).
  sonarjs.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parser: tsParser,
    },
    rules: {
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.config.*",
      "**/*.test.*",
      "**/*.spec.*",
    ],
  },
];
