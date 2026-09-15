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
  // `src/doc.ts` and `src/mint.ts` joined the glob in MUT-GLOB-KA4-1. They had
  // never been mutation-tested, and they carry the schema §1 doc layout, the
  // §1.2 opaque-widgets routing, the §5.3 shared-definition instance count and
  // the §9 bootstrap-snapshot path. Working notes for the widening live
  // outside this repository, in the in-app-agent workspace
  // (reports/audit/mut-glob-ka4.md); everything load-bearing is restated here.
  // `src/index.ts` (re-exports only), `src/types.ts` (declarations) and
  // `src/exhaustive.ts` (compile-time helper; its one runtime line throws)
  // remain out. Two semantic files should join next: `src/migrate.ts` (out only
  // because PR #30 owned it while this branch was written) and
  // `src/schema-version.ts`, which #60 added after this glob was set and which
  // holds the ONE definition of the schema read that migrate() and project()
  // share — exactly the kind of single point of truth a mutant should be
  // aimed at.
  mutate: ["src/applier.ts", "src/stamps.ts", "src/project.ts", "src/doc.ts", "src/mint.ts"],
  reporters: ["clear-text", "html", "json"],
  // Reuse unchanged mutant results between scheduled/manual CI runs. The
  // workflow restores this report from a cache keyed by the dependency lock
  // and this config, so changing any pinned measurement knob starts clean.
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",
  coverageAnalysis: "all",
  // Separate from per-mutant timeout scoring. The scheduled workflow has grown
  // past Stryker's default 5 minute initial dry-run ceiling, so pin this cap
  // high enough for the unmutated test corpus to finish without changing how
  // individual mutants are judged.
  dryRunTimeoutMinutes: 20,
  // Per-mutant budget = netTime * timeoutFactor + timeoutMS. Generous on
  // purpose: only a genuinely non-terminating mutant should ever time out.
  timeoutMS: 60000,
  timeoutFactor: 1.5,
  // Fixed worker count so the measurement does not vary with core count.
  concurrency: 4,
  // Measured 2026-08-21 on the pinned settings above, over the five-file glob:
  // 85.24% overall (1328 mutants; 1126 killed / 6 timeout / 168 survived / 28
  // no-coverage), on an idle host (load average 0.85). The SAME glob run
  // against the parent commit 9e3e38e scores 79.92% over 1290 mutants — a real
  // baseline run, not a stored figure — so the delta is this branch and nothing
  // else. See docs/mutation-testing.md.
  //
  // Threshold sits strictly UNDER the measured score, not at it — the rule #56
  // wrote in when it set the three-file threshold to 79 rather than to the
  // 80.00% it had just measured (it raised it from 60; it never shipped 80). A
  // threshold equal to the measurement passes with zero margin and turns red on
  // the first uncovered line any sibling PR adds, a failure that would say
  // "mutation score regression" while meaning "new code arrived". Raise it
  // whenever the score is raised; the margin is for new code, NOT for
  // measurement noise, which is now zero.
  thresholds: {
    break: 84,
    low: 84,
    high: 90,
  },
};
