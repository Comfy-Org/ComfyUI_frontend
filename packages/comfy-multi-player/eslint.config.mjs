import tsParser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";

const sonarRecommended = sonarjs.configs.recommended;
const sonarWarnings = Object.fromEntries(
  Object.entries(sonarRecommended.rules).map(([ruleName, setting]) => [
    ruleName,
    Array.isArray(setting) ? ["warn", ...setting.slice(1)] : "warn",
  ]),
);

export default [
  {
    ignores: ["dist/", "node_modules/", "*.config.*"],
  },
  {
    ...sonarRecommended,
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2024,
      parser: tsParser,
      sourceType: "module",
    },
    rules: sonarWarnings,
  },
];
