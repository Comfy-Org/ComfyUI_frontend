# Browser Test Flake Prevention Rules

Reference this file as `@browser_tests/FLAKE_PREVENTION_RULES.md` when
debugging or updating flaky Playwright tests.

These rules are distilled from the PR 10817 stabilization thread chain and are
intended to prevent the same classes of flakes from reappearing.

## Core Principles

- Find the root cause from CI artifacts before changing the test.
- Wait for the real readiness boundary, not the first visible DOM signal.
- Prefer the smallest behavioral assertion that proves the test's intent.
- Keep shared helpers simple; do not hide brittle timing assumptions inside
  them.

## Assertion Rules

- Prefer Playwright's built-in retrying locator assertions when a locator state
  is the thing under test.
- Use `expect.poll()` for a single async value.
- Use `expect(async () => { ... }).toPass()` only when multiple assertions must
  settle together.
- Do not make immediate assertions right after async UI mutations, settings
  writes, clipboard writes, or graph updates.
- Never use `waitForTimeout()` to paper over a race.

## Polling Rules

Use `expect.poll()` when the test is asking one question repeatedly.

Good fits:

- node count after search insertion
- persisted setting value after delete or rename
- clipboard contents after `Copy Image`
- internal graph state after a workflow reload

Example:

```ts
await expect
  .poll(() => comfyPage.settings.getSetting('Comfy.NodeLibrary.Bookmarks.V2'))
  .toEqual([])
```

Avoid this shape for a single value:

```ts
await expect(async () => {
  expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
}).toPass()
```

## Readiness Rules

- Visible is not always ready.
- If the behavior depends on internal state, wait on that internal state.
- After canvas interactions, call `await comfyPage.nextFrame()` unless the
  helper already guarantees a settled frame.
- After mutations that trigger workflow reloads or node-definition refreshes,
  wait for the reload lifecycle to finish before continuing.

Examples of real readiness boundaries:

- wait for `node.imgs` to be populated before opening image context menus
- wait for settings cleanup to finish before asserting persisted state
- wait for locale-triggered workflow reloads to complete before selecting nodes
- let the real builder UI path drive readiness instead of asserting transient
  helper metadata early

## Behavioral Over Visual Rules

- Use screenshots only when visual appearance is the behavior being tested.
- If a screenshot only indirectly proves behavior, replace it with a direct
  assertion.

Prefer assertions on:

- link counts
- node positions or bounding boxes
- visible menu items
- persisted settings
- node flags and widget values

Examples from past flakes:

- reroute behavior was more stable as link-count assertions than as a canvas
  screenshot
- node movement was more stable as a position change assertion than as a visual
  snapshot

## Interaction Rules

- Use locators that match the actual rendered label or accessible name.
- When a test interacts with a context menu for a node, select the node first
  unless the test is explicitly about selection behavior.
- Avoid `force: true` by default.
- Use `force: true` only for known transition-driven or overlay-driven cases
  where normal actionability is not the behavior under test.

Good examples for careful interaction choice:

- dialog close buttons should usually use normal `.click()` so Playwright waits
  for actionability
- transition-positioned toolbox buttons may need forced clicks when the DOM
  element is moving but the visible behavior is already correct

## Helper Rules

- Shared helpers should drive setup to a stable boundary, not assert transient
  intermediate state unless that state is the helper's explicit contract.
- If a race only matters to one spec, prefer a local wait in that spec over a
  broad helper change.
- If a helper repeatedly fails before the real test begins, remove or relax the
  brittle precondition and let the downstream UI interaction prove readiness.

Examples:

- do not assert promoted widget metadata immediately after subgraph conversion
  if later UI interactions already wait for the real state
- do not bake image-preview timing assumptions into generic context-menu helpers
  if only image-node tests need the extra readiness gate

## CI Triage Rules

- Do not trust the top-level GitHub check result alone.
- Always inspect the latest merged Playwright `report.json`, even when the run
  is green overall.
- Treat tests marked `flaky` in `report.json` as real work, not noise.
- Use `error-context.md`, trace files, and page snapshots to identify the exact
  race before changing code.
- Pull the newest run after each push instead of assuming the previous flaky set
  is unchanged.

## Local Verification Rules

- Prefer targeted reruns through `pnpm test:browser:local`.
- On Windows, prefer `file:line` or whole-spec arguments over `--grep` when the
  wrapper has quoting issues.
- Use `--repeat-each 5` for targeted flake verification unless the failure needs
  a different reproduction pattern.
- Verify with the smallest command that exercises the flaky path.

## Known Local Noise

These can block or distract local verification without being the CI root cause:

- missing `F:\ComfyUsers\BrowserTests\input\example.png`
- missing `F:\ComfyUsers\BrowserTests\models`
- teardown `EPERM` while restoring `F:\ComfyUsers\BrowserTests\user`
- local screenshot baseline differences on Windows

Rules for handling this noise:

- diagnose whether the failure occurs before the flaky path under investigation
- if a temporary local asset is needed for verification, do not commit it
- do not commit local screenshot baselines

## Quick Checklist

Before merging a flaky-test fix, confirm all of these are true:

- the latest CI artifact was inspected directly
- the root cause is stated in terms of a real race or readiness mismatch
- the fix waits on the real state boundary
- `expect.poll()` was used when the assertion is a single async value
- screenshots were removed if they only verified behavior indirectly
- local verification used targeted reruns, not broad guess-and-check loops
