---
name: perf-fix-with-proof
description: 'Ships performance fixes with CI-proven improvement using stacked PRs. PR1 adds a @perf test (establishes baseline on main), PR2 adds the fix (CI shows delta). Use when implementing a perf optimization and wanting to prove it in CI.'
---

# Performance Fix with Proof

Ships perf fixes as two stacked PRs so CI automatically proves the improvement.

## Why Two PRs

`ci-perf-report.yaml` runs the `@perf` tests on every PR and on pushes to main, where it saves a baseline to the `perf-data` branch. `pr-report.yaml` then posts a PR comment comparing the PR's metrics against those baselines. If you add a new `@perf` test in the same PR as the fix, that test doesn't exist on main yet — no baseline, no delta, no proof. Stacking solves this:

1. **PR1 (test-only)** — adds the `@perf` test that exercises the bottleneck. Merges to main. CI runs it on main → baseline established.
2. **PR2 (fix)** — adds the optimization. CI runs the same test → compares against PR1's baseline → delta shows improvement.

## Workflow

### Step 1: Create the test branch

```bash
git worktree add <worktree-path> -b perf/test-<name> origin/main
cd <worktree-path> && pnpm install --frozen-lockfile
```

The git hooks need the worktree's own `node_modules`.

### Step 2: Write the `@perf` test

Add a test to `browser_tests/tests/performance.spec.ts` (or a new file with `@perf` tag). The test should stress the specific bottleneck.

**Test structure:**

Load a workflow that exercises the bottleneck, start measuring, perform the action at scale, then stop measuring and record:

```typescript
test('<descriptive name>', async ({ comfyPage }) => {
  await comfyPage.workflow.loadWorkflow('<workflow>')
  await comfyPage.perf.startMeasuring()

  for (let i = 0; i < N; i++) {
    await comfyPage.nextFrame()
  }

  const m = await comfyPage.perf.stopMeasuring('<metric-name>')
  recordMeasurement(m)
})
```

Replace the loop body with the interaction that stresses the hot path.

**Available metrics** (from `PerformanceHelper`):

- `m.styleRecalcs` / `m.styleRecalcDurationMs` — style recalculation count and time
- `m.layouts` / `m.layoutDurationMs` — forced layout count and time
- `m.taskDurationMs` — total main-thread JS execution time
- `m.heapDeltaBytes` — memory pressure delta. `REPORTED_METRICS` in `scripts/perf-report.ts` leaves it out of the PR report's Δ table, so it cannot prove a fix in Step 8

**Key helpers** (from `ComfyPage`):

- `comfyPage.perf.startMeasuring()` / `.stopMeasuring(name)` — CDP metrics capture
- `comfyPage.nextFrame()` — wait one animation frame
- `comfyPage.workflow.loadWorkflow(name)` — load a test workflow from `browser_tests/assets/`
- `comfyPage.canvas` — the canvas locator
- `comfyPage.page.mouse.move(x, y)` — mouse interaction

### Step 3: Add test workflow asset (if needed)

If the bottleneck needs a specific workflow (e.g., 50+ nodes, many DOM widgets), add it to `browser_tests/assets/`. Keep it minimal — only the structure needed to trigger the bottleneck.

### Step 4: Verify locally

```bash
pnpm exec playwright test --project=performance --grep "<test name>"
```

Confirm the test runs and produces reasonable metric values.

### Step 5: Create PR1 (test-only)

The pre-commit hook formats, lints and runs `pnpm typecheck:browser` for staged `browser_tests/` files; do not run repo-wide `pnpm lint` or `pnpm typecheck`.

```bash
git add browser_tests/
pnpm lint:unstaged:fix
git commit -m "test: add perf test for <bottleneck description>"
git push -u origin perf/test-<name>
gh pr create --title "test: add perf test for <bottleneck>" \
  --body "Adds a @perf test to establish a baseline for <bottleneck>.

This is PR 1 of 2. The fix will follow in a separate PR once this baseline is established on main.

## What
Adds \`<test-name>\` to the performance test suite measuring <metric> during <action>.

## Why
Needed to prove the improvement from the upcoming fix for <issue link>." \
  --base main
```

### Step 6: Get PR1 merged

Once PR1 merges, CI runs the test on main and saves the baseline to the `perf-data` branch. A failed save does not fail that job, so check the newest 15 files in `baselines/` on `perf-data`, the ones `pr-report.yaml` loads, for the name PR1 passes to `stopMeasuring()`. PR2 needs at least two of those 15 to contain it: `scripts/perf-stats.ts` computes no z-score from fewer samples, nor from samples that never vary (Step 8 covers that case). The report's Baseline column comes from a different source: the `perf-metrics` artifact of the newest `ci-perf-report.yaml` push run on main. Confirm that artifact contains the measurement too; if it does not, the row shows `new` with no comparison.

### Step 7: Create PR2 (fix) on top of main

```bash
git worktree add <worktree-path> -b perf/fix-<name> origin/main
```

Implement the fix. The `@perf` test from PR1 is now on main and will run automatically. CI will:

1. Run the test on the PR branch
2. Compare against the `perf-data` baselines from main, which include PR1's test
3. Post the delta in the unified PR report comment (`pr-report.yaml`)

### Step 8: Verify the improvement shows in CI

Read the performance section of the PR report comment. The Sig column shows `z=…` for any row with a z-score and marks only regressions (`⚠️`), so read the number. The fix is proven when the target metric's Δ is negative and its z is below -2. Count metrics with a `minAbsDelta` in `REPORTED_METRICS` (`scripts/perf-report.ts`) also need an absolute change of at least that much; below it the row is neutral whatever its z.

A count that never varied on main shows `—` instead of a z-score. Prove that fix from the per-sample values in the baseline and PR `perf-metrics` artifacts: every PR sample must be lower than every baseline sample. Neither the Baseline and PR columns (medians) nor a σ of 0 in `Historical variance` (spread of run means, not of samples within a run) is enough on its own.

If PR2's perf job ran before those baselines existed, rerun it once they do.

## Test Design Guidelines

1. **Stress the specific bottleneck** — don't measure everything, isolate the hot path
2. **Use enough iterations** — the test should run long enough that the metric difference is clear (100+ frames for idle tests, 50+ interactions for event tests)
3. **Keep it deterministic** — avoid timing-dependent assertions; measure counts not durations when possible
4. **Link the issue** — reference the tracking issue in the PR description

## Examples

**Testing DOM widget reactive mutations:**

```typescript
test('DOM widget positioning recalculations', async ({ comfyPage }) => {
  await comfyPage.workflow.loadWorkflow('default')
  await comfyPage.perf.startMeasuring()
  for (let i = 0; i < 120; i++) {
    await comfyPage.nextFrame()
  }
  const m = await comfyPage.perf.stopMeasuring('dom-widget-idle')
  recordMeasurement(m)
})
```

**Testing measureText caching:**

```typescript
test('canvas text rendering with many nodes', async ({ comfyPage }) => {
  await comfyPage.workflow.loadWorkflow('large-graph-workflow')
  await comfyPage.perf.startMeasuring()
  for (let i = 0; i < 60; i++) {
    await comfyPage.nextFrame()
  }
  const m = await comfyPage.perf.stopMeasuring('text-rendering-large-graph')
  recordMeasurement(m)
})
```

## Reference

| Resource          | Path                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| Perf test file    | `browser_tests/tests/performance.spec.ts`                                        |
| PerformanceHelper | `browser_tests/fixtures/helpers/PerformanceHelper.ts`                            |
| Perf reporter     | `browser_tests/fixtures/utils/perfReporter.ts`                                   |
| CI workflow       | `.github/workflows/ci-perf-report.yaml`                                          |
| PR comment        | `.github/workflows/pr-report.yaml`                                               |
| Report generator  | `scripts/perf-report.ts`                                                         |
| Stats utilities   | `scripts/perf-stats.ts`                                                          |
| Incident runbook  | `docs/guidance/performance-incident-runbook.md`                                  |
| Measurement ADR   | `docs/adr/PERF-BENCHMARKS-0022-performance-evidence-and-regression-framework.md` |
