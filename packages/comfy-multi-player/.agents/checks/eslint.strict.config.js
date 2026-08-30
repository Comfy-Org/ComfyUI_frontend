/**
 * Strict ESLint config for the sonarjs-lint review check and the statelessness gate.
 *
 * Uses eslint-plugin-sonarjs for SonarQube-grade analysis without a server.
 * The source rules are shared by code review and `check:stateless`; this is
 * intentionally the package's only static-analysis seam.
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

const statelessRules = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "pinia", message: "KA-13: caller-owned state only (see docs/INVARIANTS.md)." },
        { name: "vuex", message: "KA-13: caller-owned state only (see docs/INVARIANTS.md)." },
        { name: "vue", message: "KA-3/KA-13: cmp is DOM/framework-free and stateless (see docs/INVARIANTS.md)." },
      ],
      patterns: [
        {
          group: ["pinia/*", "vuex/*", "vue/*", "@vue/*"],
          message: "KA-3/KA-13: UI/reactivity imports do not belong in cmp.",
        },
      ],
    },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "Program > VariableDeclaration[kind='let'], Program > VariableDeclaration[kind='var']",
      message: "KA-13: no module-level let/var; caller-owned state only.",
    },
    {
      selector:
        "Program > VariableDeclaration > VariableDeclarator:not([id.name='documentTransactionTails']) > NewExpression[callee.type='Identifier'][callee.name=/^(Map|Set|WeakMap|WeakSet)$/]",
      message: "KA-13: no module-level mutable collection except the documented Y.Doc-keyed admission queue; inject state through the caller.",
    },
  ],
};

export default [
  // `CMP_STATELESS_ONLY=1` lets the merge-blocking gate reuse this config's
  // parser/files/ignore seam without inheriting unrelated review findings.
  ...(process.env.CMP_STATELESS_ONLY === "1" ? [] : [sonarjs.configs.recommended]),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parser: tsParser,
    },
    rules: {
      ...(process.env.CMP_STATELESS_ONLY === "1" ? {} : { "sonarjs/cognitive-complexity": ["error", 15] }),
      ...statelessRules,
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
