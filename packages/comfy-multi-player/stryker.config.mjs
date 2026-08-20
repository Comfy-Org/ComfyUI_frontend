/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  mutate: ["src/applier.ts", "src/stamps.ts", "src/project.ts"],
  reporters: ["clear-text", "html", "json"],
  coverageAnalysis: "perTest",
  // Baseline measured 2026-08-20: 63.70% overall mutation score.
  thresholds: {
    break: 60,
  },
};
