/**
 * Stryker configuration.
 *
 * `timeoutMS`, `timeoutFactor`, `concurrency` and `coverageAnalysis` are PINNED
 * DELIBERATELY. Stryker scores a `Timeout` outcome as *killed*, so with those
 * knobs left at their defaults the mutation score is a function of host load
 * rather than of the test suite — and it moves in the flattering direction: the
 * busier the machine, the more mutants time out, the HIGHER the score.
 * Measured on this tree, unpinned: 80.00% idle and 81.41% under 20 CPU
 * spinners, because 13 real survivors were reclassified as timeouts and scored
 * as kills. Do not unpin these without re-measuring; any score produced with
 * different values is not comparable.
 *
 * `coverageAnalysis: "all"` rather than `"perTest"`: `"all"` runs every test
 * against every mutant, so the outcome cannot depend on Stryker's per-test
 * coverage attribution. On this tree the two agree on an idle host (identical
 * 154-survivor set), and `"all"` costs about 2.4x the wall time; it is pinned
 * because it removes a variable, not because `perTest` was observed to
 * mis-classify here.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  testRunner: "vitest",
  mutate: ["src/applier.ts", "src/stamps.ts", "src/project.ts"],
  reporters: ["clear-text", "html", "json"],
  coverageAnalysis: "all",
  // Per-mutant budget = netTime * timeoutFactor + timeoutMS. Generous on
  // purpose: only a genuinely non-terminating mutant should ever time out.
  timeoutMS: 60000,
  timeoutFactor: 1.5,
  // Fixed worker count so the measurement does not vary with core count.
  concurrency: 4,
  // Measured 2026-08-21 on the pinned settings above, at this commit: 80.00%
  // overall over 925 mutants, run twice — once idle and once under 20 CPU
  // spinners (load average 8.2 vs 33.8). Same score to two decimals, and the
  // Survived (154) and NoCoverage (31) SETS were element-for-element identical;
  // only one non-terminating loop mutant moved between Killed and Timeout,
  // which is score-neutral. That stability is the whole point of the pins.
  //
  // Threshold sits strictly UNDER the measured score, not at it. 80.00% is
  // exactly 740/925, so `break: 80` would pass with zero margin and turn red on
  // the first uncovered line any sibling PR adds — a failure that would say
  // "mutation score regression" while meaning "new code arrived". One point is
  // roughly nine mutants of headroom. Raise it whenever the score is raised;
  // the margin is for new code, NOT for measurement noise, which is now zero.
  thresholds: {
    break: 79,
    low: 79,
    high: 90,
  },
};
