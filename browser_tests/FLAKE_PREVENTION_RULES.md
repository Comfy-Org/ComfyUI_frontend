# Browser Test Flake Prevention Rules

Reference this file as `@browser_tests/FLAKE_PREVENTION_RULES.md` when
debugging or updating flaky Playwright tests.

These rules are distilled from the PR 10817 stabilization thread chain. They
exist to make flaky-test triage faster and more repeatable.

## Quick Checklist

Before merging a flaky-test fix, confirm all of these are true:

- the latest CI artifact was inspected directly
- every `.click()` is preceded by `await expect(locator).toBeVisible()`
- the root cause is stated as a race or readiness mismatch
- the fix waits on the real readiness boundary
- the assertion primitive matches the job
- the fix stays local unless a shared helper truly owns the race
- local verification uses a targeted rerun

## 1. Start With CI Evidence

- Do not trust the top-level GitHub check result alone.
- Inspect the latest Playwright `report.json` directly, even on a green run.
- Treat tests marked `flaky` in `report.json` as real work.
- Use `error-context.md`, traces, and page snapshots before editing code.
- Pull the newest run after each push instead of assuming the flaky set is
  unchanged.

## 2. Assert Visibility Before Every Click

- Every `await locator.click()` must be preceded by
  `await expect(locator).toBeVisible()`.
- This gives an immediate, descriptive failure ("expected element to be visible")
  instead of a generic actionability timeout.
- Exceptions (do NOT add the assertion):
  - `click({ force: true })` — intentionally bypasses actionability checks.
  - Canvas / mouse coordinate clicks (`comfyPage.canvas.click(...)`,
    `page.mouse.click(x, y)`).
  - Custom click methods with string args (`node.click('title')`,
    `confirmDialog.click('save')`).
  - Clicks inside `.catch()` chains (fire-and-forget cleanup).
  - Clicks inside `expect(async () => { ... }).toPass()` retry blocks.
  - `NodeWidgetReference.click()` (canvas coordinate-based).
- If a visibility check already exists within the preceding 3 lines
  (`toBeVisible()`, `waitFor({ state: 'visible' })`), do not duplicate it.

## 3. Wait For The Real Readiness Boundary

- Visible is not always ready.
- If the behavior depends on internal state, wait on that state.
- After canvas interactions, call `await comfyPage.nextFrame()` unless the
  helper already guarantees a settled frame.
- After workflow reloads or node-definition refreshes, wait for the reload to
  finish before continuing.

Common readiness boundaries:

- `node.imgs` populated before opening image context menus
- settings cleanup finished before asserting persisted state
- locale-triggered workflow reload finished before selecting nodes
- real builder UI ready, not transient helper metadata

## 4. Choose The Smallest Correct Assertion

- Use built-in retrying locator assertions when locator state is the behavior.
- Use `expect.poll()` for a single async value.
- Use `expect(async () => { ... }).toPass()` only when multiple assertions must
  settle together.
- Do not make immediate assertions after async UI mutations, settings writes,
  clipboard writes, or graph updates.
- Never use `waitForTimeout()` to hide a race.

```ts
await expect
  .poll(() => comfyPage.settings.getSetting('Comfy.NodeLibrary.Bookmarks.V2'))
  .toEqual([])
```

## 5. Prefer Behavioral Assertions

- Use screenshots only when appearance is the behavior under test.
- If a screenshot only indirectly proves behavior, replace it with a direct
  assertion.
- Prefer assertions on link counts, positions, visible menu items, persisted
  settings, and node state.

## 6. Keep Helper Changes Narrow

- Shared helpers should drive setup to a stable boundary.
- Do not encode one-spec timing assumptions into generic helpers.
- If a race only matters to one spec, prefer a local wait in that spec.
- If a helper fails before the real test begins, remove or relax the brittle
  precondition and let downstream UI interaction prove readiness.

## 7. Verify Narrowly

- Prefer targeted reruns through `pnpm test:browser:local`.
- On Windows, prefer `file:line` or whole-spec arguments over `--grep` when the
  wrapper has quoting issues.
- Use `--repeat-each 5` for targeted flake verification unless the failure needs
  a different reproduction pattern.
- Verify with the smallest command that exercises the flaky path.

## Current Local Noise

These are local distractions, not automatic CI root causes:

- missing local input fixture files required by the test path
- missing local models directory
- teardown `EPERM` while restoring the local browser-test user data directory
- local screenshot baseline differences on Windows

Rules for handling local noise:

- first confirm whether it blocks the exact flaky path under investigation
- do not commit temporary local assets used only for verification
- do not commit local screenshot baselines
