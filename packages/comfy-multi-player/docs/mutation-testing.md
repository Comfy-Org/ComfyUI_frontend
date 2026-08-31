# Mutation testing

Stryker measures whether the test suite detects behavioral regressions in the load-bearing CRDT code. The scope is `src/applier.ts`, `src/stamps.ts`, `src/project.ts`, `src/doc.ts` and `src/mint.ts`; tests, `src/index.ts` (re-exports only), `src/types.ts` (declarations), `src/exhaustive.ts` (a compile-time helper whose one runtime line is a `throw`) and `src/migrate.ts` are not mutated. Two semantic files remain unmeasured and should join the glob next: `src/migrate.ts` (kept out only because PR #30 owned it while this branch was written — #30 has merged and made it the fail-closed read gate) and `src/schema-version.ts`, which #60 added after this glob was set and which now holds the ONE definition of the schema read that `migrate()` and `project()` share.

`src/doc.ts` and `src/mint.ts` were added in MUT-GLOB-KA4-1 and had never been mutated before that. Do not narrow the glob back: the two files carry the schema §1 doc layout, the §1.2 opaque-widgets routing, the §5.3 shared-definition instance count and the §9 bootstrap-snapshot path, and every one of those was unmeasured while the score read 80.00%.

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

The unpinned rows show what the pins are for. Unpinned and idle the number happens to agree; unpinned and loaded it gains 1.41 points, because 13 mutants that really do survive — seven on `validateEnvelope`'s `typeof` guard at `src/applier.ts:203`, six in `project.ts`, none of them anywhere near a loop — exceed the default 5s budget and are scored as kills.

`stryker.config.mjs` pins `timeoutMS`, `timeoutFactor`, `concurrency` and `coverageAnalysis` for exactly this reason. **Do not unpin them.** A score produced with different values is not comparable to any score recorded here.

`dryRunTimeoutMinutes` is pinned separately from the mutation score knobs. It
only bounds Stryker's initial unmutated Vitest pass; it does not decide whether
any mutant is `Killed`, `Survived` or `Timeout`. The scheduled workflow reached
Stryker's default 5 minute initial dry-run ceiling on 2026-08-31 before it could
write `reports/mutation/mutation.json`, so the report checker and artifact
upload failed only as downstream symptoms. Raising this dry-run cap keeps the
nightly from failing before the measured mutation phase while preserving the
per-mutant `timeoutMS`, `timeoutFactor`, `concurrency` and `coverageAnalysis`
pins that make scores comparable.

Incremental mode reuses results only when Stryker proves that the mutant and its
covering tests are unchanged. CI restores `reports/stryker-incremental.json` from
a cache keyed by the operating system, `package-lock.json`, and
`stryker.config.mjs`; changing a dependency or any pinned measurement setting
therefore forces a full run. Each workflow run uses a unique cache save key and
restores the newest compatible report, avoiding GitHub Actions cache-key
immutability while still carrying results forward.

## Current baseline

Measured 2026-08-21 on the pinned settings over the five-file glob, at `main` = `9e3e38e`:
**85.24% overall** across 1328 mutants (`applier.ts` 80.55%, `doc.ts` 94.09%, `mint.ts` 88.68%,
`project.ts` 87.43%, `stamps.ts` 89.00%), with 1126 killed / 6 timeout / 168 survived / 28
no-coverage. The break threshold is **84**, 1.24 points under the measured score for the reason #56
recorded when it set the three-file threshold to 79 rather than to the 80.00% it had just measured:
a threshold equal to the measurement passes with zero margin and goes red the first time a sibling
PR adds an uncovered line, reporting "mutation score regression" when it means "new code arrived".
Raise the threshold whenever the score is raised; the headroom is for new code, not for measurement
noise, which the pins have removed. The timeouts-as-survivors floor — the score if every timeout
were really a survivor — is 84.79%, which is also above the threshold, so the pass does not depend
on how the 6 timeouts are classified.

**Host conditions, stated because this number is load-sensitive by construction.** Both runs below
were taken on a 28-core host at 1-minute load averages of **2.16** (baseline) and **0.85** (branch),
Node 25.9.0, pins untouched. An earlier attempt at this measurement was made while the host carried
five concurrent agents at load 15-19; one of its runs was killed by the OOM killer, and none of that
attempt's figures are reported here. Refusing to publish a number measured under those conditions is
the correct outcome, not a gap.

Per-scope movement, kept because the *shape* of the change matters more than the headline. Both
"before" columns are a real run of the SAME five-file glob against `origin/main` `9e3e38e` (passed
on the command line with `--mutate`, pins untouched), so the only difference between the columns is
this branch:

| Scope | Before (`9e3e38e`) | After | What moved |
| --- | --- | --- | --- |
| five-file overall | 79.92% (1031/1290) | **85.24%** (1132/1328) | both rows below |
| `applier.ts` + `stamps.ts` + `project.ts` | 81.52% (803/985) | 82.74% (815/985) | the KA-4 rejection sweep (`test/ka4-rejection-byte-identity.test.ts`) |
| `doc.ts` + `mint.ts` | 74.75% (228/305, first ever run) | 92.42% (317/343) | `test/doc-mint-mutation-survivors.test.ts` |

Reproducibility of the five-file glob, measured rather than asserted. At the previous base this
branch was run twice, at load averages 2.99 and 8.90: identical to two decimals and in every
per-file killed/timeout/survived/no-coverage column. At the base before that it was run twice more
and the `Killed`, `Timeout`, `Survived` and `NoCoverage` **sets** were element-for-element
identical, symmetric difference zero. What is stable is the survivor *list*, not merely the
percentage. The overall score does move between bases — 85.31% at `32ab1f2`, 85.24% here — but only
because `main` itself moved: #60 added one `project.ts` survivor. That is exactly why a "before" is
re-measured at the same commit rather than quoted from a previous run.

The `doc.ts` + `mint.ts` mutant total rises from 305 to 343 because the fix itself adds code, so the
"after" column is measured over more surface, not less.

The three-file scope reads 81.61% here rather than the 80.00% (740/925) `main` recorded when the pin
landed, because #67 and #31 have since added tests and code. That is the point of re-measuring the
baseline at the same commit rather than quoting a stored number: a "before" from a different `main`
is not a before.

Adding files to the glob moves the headline for two reasons at once — new mutants, and new tests — so compare per-file columns, never the single overall number, when judging whether a change helped.

Earlier figures on this page do not survive. **63.70%** (once recorded here) and **74.81%** (recorded in the workspace) were produced with the knobs unpinned and are void — not low, not high, just not measurements of the test suite.

One more figure is withdrawn rather than merely stale. An earlier revision of this branch cited
**81.41%** as the "after" for the three-file scope. That number is `main`'s **unpinned, under
contention** three-file figure from the two-by-two table above — a documented measurement artifact,
not a measurement of this branch. Do not re-cite it.

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

Stryker writes local HTML and JSON reports plus the incremental report under
`reports/`; generated reports and `.stryker-tmp/` are ignored by git.
`.github/workflows/mutation.yml` runs nightly and by manual
`workflow_dispatch`, not on every pull request; it caches the incremental report
and uploads `reports/mutation/` as a build artifact so a failing run leaves
something to read.
