# Mutation testing

Stryker measures whether the test suite detects behavioral regressions in the load-bearing CRDT code. The initial scope is deliberately limited to `src/applier.ts`, `src/stamps.ts`, and `src/project.ts`; tests and the rest of `src/` are not mutated.

## The score only means something because the run is pinned

Stryker classifies each mutant `Killed`, `Survived`, `Timeout`, `NoCoverage` or an error, and **scores a `Timeout` as detected**. That is right for a mutant that genuinely cannot terminate (`while (…)` mutated to `while (true)`) and wrong for a mutant that merely ran slowly because the machine was busy — and the report cannot tell those apart on its own. With `timeoutMS` and `concurrency` left at their defaults, the score is therefore a function of host load, and it moves in the flattering direction: **more contention, more timeouts, higher score.**

Measured on this repo, four runs of one commit on one machine, two configurations by two load levels ("contended" = 20 CPU spinner processes for the duration of the run):

| Config | Contended | Killed | Timeout | Survived | NoCov | Score |
| --- | --- | --- | --- | --- | --- | --- |
| pinned | no | 732 | 8 | 154 | 31 | **80.00%** |
| pinned | **yes** | 733 | 7 | 154 | 31 | **80.00%** |
| unpinned | no | 732 | 8 | 154 | 31 | 80.00% |
| unpinned | **yes** | 732 | **21** | **141** | 31 | **81.41%** |

A fifth run of the pinned config on Node 22 — the version `mutation.yml` uses — reproduced the pinned rows exactly, including every per-file column, so the number does not depend on the Node major either.

The pinned rows are identical to two decimals, and their `Survived` and `NoCoverage` sets are element-for-element identical — the survivor *list*, which is what a coverage-gap audit actually consumes, does not move. Only one non-terminating loop mutant swapped between `Killed` and `Timeout`, and both count as detected, so it is score-neutral.

The unpinned rows show what the pins are for. Unpinned and idle the number happens to agree; unpinned and loaded it gains 1.41 points, because 13 mutants that really do survive — seven on `validateEnvelope`'s `typeof` guard at `src/applier.ts:106`, six in `project.ts`, none of them anywhere near a loop — exceed the default 5s budget and are scored as kills.

`stryker.config.mjs` pins `timeoutMS`, `timeoutFactor`, `concurrency` and `coverageAnalysis` for exactly this reason. **Do not unpin them.** A score produced with different values is not comparable to any score recorded here.

## Current baseline

Measured 2026-08-21 on the pinned settings, over 925 mutants: **80.00% overall** (`applier.ts` 77.79%, `stamps.ts` 89.00%, `project.ts` 83.14%), reproduced idle and under contention as above. The break threshold is **79%**, strictly under the measured score. It is deliberately not 80: the score is exactly 740/925, so a threshold equal to the measurement passes with zero margin and goes red the first time a sibling PR adds an uncovered line — reporting "mutation score regression" when it means "new code arrived". Raise the threshold whenever the score is raised; the ~1 point of headroom is for new code, not for measurement noise, which the pins have removed.

Earlier figures on this page do not survive. **63.70%** (once recorded here) and **74.81%** (recorded in the workspace) were produced with the knobs unpinned and are void — not low, not high, just not measurements of the test suite.

The triple **84.38% / 88.01% / 74.59%** was previously cited here as the proof of load-sensitivity. It is withdrawn, and for a sharper reason than staleness: those three runs differed in their `coverageAnalysis`/`timeoutMS`/`concurrency` *flags*, not in host load, so they never evidenced the load claim they were offered for. They do show the score is a function of the knobs. The load half is the two-by-two table above, measured here at fixed settings.

## Running it

```sh
npm ci
npm run build
npm run test:mutation
npm run check:mutation-report
```

Node 22 or newer.

`check:mutation-report` is the fail-closed half of the fix. It re-derives the score from `reports/mutation/mutation.json`, prints `Timeout` as its own outcome next to the "timeouts-as-survivors floor" the score cannot fall below, and exits:

| Exit | Meaning |
| --- | --- |
| 0 | conclusive, at or above the break threshold |
| 1 | conclusive, below the break threshold |
| 2 | **INCONCLUSIVE** — no report, fewer than 500 mutants, more than 2% of detected mutants were timeouts, or the report carries no `thresholds.break` to judge against |

INCONCLUSIVE is not a pass. Re-run on a quieter machine; do not record the score.

Stryker writes local HTML and JSON reports under `reports/mutation/`; generated reports and `.stryker-tmp/` are ignored by git. `.github/workflows/mutation.yml` runs nightly and by manual `workflow_dispatch`, not on every pull request; it uploads `reports/mutation/` as a build artifact so a failing run leaves something to read.
