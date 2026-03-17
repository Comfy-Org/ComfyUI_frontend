---
name: perf-fix-with-proof
description: 'Ships performance fixes with CI-proven improvement using stacked PRs. PR1 adds a @perf test (establishes baseline on main), PR2 adds the fix (CI shows delta). Use when implementing a perf optimization and wanting to prove it in CI.'
---

# Performance Fix with Proof

Ships perf fixes as two stacked PRs so CI automatically proves the improvement.

## Why Two PRs

The `ci-perf-report.yaml` workflow compares PR metrics against the **base branch baseline**. If you add a new `@perf` test in the same PR as the fix, that test doesn't exist on main yet — no baseline, no delta, no proof. Stacking solves this:

1. **PR1 (test-only)** — adds the `@perf` test that exercises the bottleneck. Merges to main. CI runs it on main → baseline established.
2. **PR2 (fix)** — adds the optimization. CI runs the same test → compares against PR1's baseline → delta shows improvement.

## Workflow

### Step 1: Create the test branch

```bash
git worktree add <worktree-path> -b perf/test-<name> origin/main
```

### Step 2: Write the `@perf` test

Add a test to `browser_tests/tests/performance.spec.ts` (or a new file with `@perf` tag). The test should stress the specific bottleneck.

**Test structure:**

```typescript
test('<descriptive name>', async ({ comfyPage }) => {
  // 1. Load a workflow that exercises the bottleneck
  await comfyPage.workflow.loadWorkflow('<workflow>')

  // 2. Start measuring
  await comfyPage.perf.startMeasuring()

  // 3. Perform the action that triggers the bottleneck (at scale)
  for (let i = 0; i < N; i++) {
    // ... stress the hot path ...
    await comfyPage.nextFrame()
  }

  // 4. Stop measuring and record
  const m = await comfyPage.perf.stopMeasuring('<metric-name>')
  recordMeasurement(m)
  console.log(`<name>: ${m.styleRecalcs} recalcs, ${m.layouts} layouts`)
})
```

**Available metrics** (from `PerformanceHelper`):

- `m.styleRecalcs` / `m.styleRecalcDurationMs` — style recalculation count and time
- `m.layouts` / `m.layoutDurationMs` — forced layout count and time
- `m.taskDurationMs` — total main-thread JS execution time
- `m.heapDeltaBytes` — memory pressure delta

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

```bash
pnpm typecheck:browser
pnpm lint
git add browser_tests/
git commit -m "test: add perf test for <bottleneck description>"
git push -u origin perf/test-<name>
gh pr create --title "test: add perf test for <bottleneck>" \
  --body "Adds a @perf test to establish a baseline for <bottleneck>.

This is PR 1 of 2. The fix will follow in a separate PR once this baseline is established on main.

## What
Adds \`<test-name>\` to the performance test suite measuring <metric> during <action>.

## Why
Needed to prove the improvement from the upcoming fix for backlog item #<N>." \
  --base main
```

### Step 6: Get PR1 merged

Once PR1 merges, CI runs the test on main → baseline artifact saved.

### Step 7: Create PR2 (fix) on top of main

```bash
git worktree add <worktree-path> -b perf/fix-<name> origin/main
```

Implement the fix. The `@perf` test from PR1 is now on main and will run automatically. CI will:

1. Run the test on the PR branch
2. Download the baseline from main (which includes PR1's test results)
3. Post a PR comment showing the delta

### Step 8: Verify the improvement shows in CI

The `ci-perf-report.yaml` posts a comment like:

```markdown
## ⚡ Performance Report

| Metric                | Baseline | PR (n=3) | Δ    | Sig |
| --------------------- | -------- | -------- | ---- | --- |
| <name>: style recalcs | 450      | 12       | -97% | 🟢  |
```

If Δ is negative for the target metric, the fix is proven.

## Test Design Guidelines

1. **Stress the specific bottleneck** — don't measure everything, isolate the hot path
2. **Use enough iterations** — the test should run long enough that the metric difference is clear (100+ frames for idle tests, 50+ interactions for event tests)
3. **Keep it deterministic** — avoid timing-dependent assertions; measure counts not durations when possible
4. **Match the backlog entry** — reference the backlog item number in the test name or PR description

## Examples

**Testing DOM widget reactive mutations (backlog #8):**

```typescript
test('DOM widget positioning recalculations', async ({ comfyPage }) => {
  await comfyPage.workflow.loadWorkflow('default')
  await comfyPage.perf.startMeasuring()
  // Idle for 120 frames — DOM widgets update position every frame
  for (let i = 0; i < 120; i++) {
    await comfyPage.nextFrame()
  }
  const m = await comfyPage.perf.stopMeasuring('dom-widget-idle')
  recordMeasurement(m)
})
```

**Testing measureText caching (backlog #4):**

```typescript
test('canvas text rendering with many nodes', async ({ comfyPage }) => {
  await comfyPage.workflow.loadWorkflow('large-workflow-50-nodes')
  await comfyPage.perf.startMeasuring()
  for (let i = 0; i < 60; i++) {
    await comfyPage.nextFrame()
  }
  const m = await comfyPage.perf.stopMeasuring('text-rendering-50-nodes')
  recordMeasurement(m)
})
```

## Reference

| Resource          | Path                                                  |
| ----------------- | ----------------------------------------------------- |
| Perf test file    | `browser_tests/tests/performance.spec.ts`             |
| PerformanceHelper | `browser_tests/fixtures/helpers/PerformanceHelper.ts` |
| Perf reporter     | `browser_tests/helpers/perfReporter.ts`               |
| CI workflow       | `.github/workflows/ci-perf-report.yaml`               |
| Report generator  | `scripts/perf-report.ts`                              |
| Stats utilities   | `scripts/perf-stats.ts`                               |
| Backlog           | `docs/perf/BACKLOG.md` (local only, not committed)    |
| Playbook          | `docs/perf/PLAYBOOK.md` (local only, not committed)   |
