---
name: hardening-flaky-e2e-tests
description: 'Diagnoses and fixes flaky Playwright e2e tests by replacing race-prone patterns with retry-safe alternatives. Use when triaging CI flakes, hardening spec files, fixing timing races, or asked to stabilize browser tests. Triggers on: flaky, flake, harden, stabilize, race condition in e2e, intermittent failure.'
---

# Hardening Flaky E2E Tests

Fix flaky Playwright specs by identifying race-prone patterns and replacing them with retry-safe alternatives. This skill covers diagnosis, pattern matching, and mechanical transforms — not writing new tests (see `writing-playwright-tests` for that).

## Workflow

### 1. Gather CI Evidence

```bash
gh run list --workflow=ci-test.yaml --limit=5
gh run download <run-id> -n playwright-report
```

- Open `report.json` and search for `"status": "flaky"` entries.
- Collect file paths, test titles, and error messages.
- Do NOT trust green checks alone — flaky tests that passed on retry still need fixing.
- Use `error-context.md`, traces, and page snapshots before editing code.
- Pull the newest run after each push instead of assuming the flaky set is unchanged.

### 2. Classify the Flake

Read the failing assertion and match it against the pattern table. Most flakes fall into one of these categories:

| #   | Pattern                               | Signature in Code                                         | Fix                                                              |
| --- | ------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | **Snapshot-then-assert**              | `expect(await evaluate()).toBe(x)`                        | `await expect.poll(() => evaluate()).toBe(x)`                    |
| 2   | **Immediate count**                   | `const n = await loc.count(); expect(n).toBe(3)`          | `await expect(loc).toHaveCount(3)`                               |
| 3   | **nextFrame after menu click**        | `clickMenuItem(x); nextFrame()`                           | `clickMenuItem(x); contextMenu.waitForHidden()`                  |
| 4   | **Tight poll timeout**                | `expect.poll(..., { timeout: 250 })`                      | ≥2000 ms; prefer default 5000 ms                                 |
| 5   | **Immediate evaluate after mutation** | `setSetting(k, v); expect(await evaluate()).toBe(x)`      | `await expect.poll(() => evaluate()).toBe(x)`                    |
| 6   | **Screenshot without readiness**      | `loadWorkflow(); nextFrame(); toHaveScreenshot()`         | `waitForNodes()` or poll state first                             |
| 7   | **Non-deterministic node order**      | `getNodeRefsByType('X')[0]` with >1 match                 | `getNodeRefById(id)` or guard `toHaveLength(1)`                  |
| 8   | **Fake readiness helper**             | Helper clicks but doesn't assert state                    | Remove; poll the actual value                                    |
| 9   | **Immediate graph state after drop**  | `expect(await getLinkCount()).toBe(1)`                    | `await expect.poll(() => getLinkCount()).toBe(1)`                |
| 10  | **Immediate boundingBox/layout read** | `const box = await loc.boundingBox(); expect(box!.width)` | `await expect.poll(() => loc.boundingBox().then(b => b?.width))` |

### 3. Apply the Transform

#### Rule: Choose the Smallest Correct Assertion

- **Locator state** → use built-in retrying assertions: `toBeVisible()`, `toHaveText()`, `toHaveCount()`, `toHaveClass()`
- **Single async value** → `expect.poll(() => asyncFn()).toBe(expected)`
- **Multiple assertions that must settle together** → `expect(async () => { ... }).toPass()`
- **Never** use `waitForTimeout()` to hide a race.

```typescript
// ✅ Single value — use expect.poll
await expect
  .poll(() => comfyPage.page.evaluate(() => window.app!.graph.links.length))
  .toBe(3)

// ✅ Locator count — use toHaveCount
await expect(comfyPage.page.locator('.dom-widget')).toHaveCount(2)

// ✅ Multiple conditions — use toPass
await expect(async () => {
  expect(await node1.getValue()).toBe('foo')
  expect(await node2.getValue()).toBe('bar')
}).toPass({ timeout: 5000 })
```

#### Rule: Wait for the Real Readiness Boundary

Visible is not always ready. Prefer user-facing assertions when possible; poll internal state only when there is no UI surface to assert on.

Common readiness boundaries:

| After this action...                   | Wait for...                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
| Canvas interaction (drag, click node)  | `await comfyPage.nextFrame()`                                |
| Menu item click                        | `await contextMenu.waitForHidden()`                          |
| Workflow load                          | `await comfyPage.workflow.loadWorkflow(...)` (built-in wait) |
| Settings write                         | Poll the setting value with `expect.poll()`                  |
| Node pin/bypass/collapse toggle        | `await expect.poll(() => nodeRef.isPinned()).toBe(true)`     |
| Graph mutation (add/remove node, link) | Poll link/node count                                         |
| Clipboard write                        | Poll pasted value                                            |
| Screenshot                             | Ensure nodes are rendered: `waitForNodes()` or poll state    |

#### Rule: Expose Locators for Retrying Assertions

When a helper returns a count via `await loc.count()`, callers can't use `toHaveCount()`. Expose the underlying `Locator` as a getter so callers choose between:

```typescript
// Helper exposes locator
get domWidgets(): Locator {
  return this.page.locator('.dom-widget')
}

// Caller uses retrying assertion
await expect(comfyPage.domWidgets).toHaveCount(2)
```

Replace count methods with locator getters so callers can use retrying assertions directly.

#### Rule: Fix Check-then-Act Races in Helpers

```typescript
// ❌ Race: count can change between check and waitFor
const count = await locator.count()
if (count > 0) {
  await locator.waitFor({ state: 'hidden' })
}

// ✅ Direct: waitFor handles both cases
await locator.waitFor({ state: 'hidden' })
```

#### Rule: Remove force:true from Clicks

`force: true` bypasses actionability checks, hiding real animation/visibility races. Remove it and fix the underlying timing issue.

```typescript
// ❌ Hides the race
await closeButton.click({ force: true })

// ✅ Surfaces the real issue — fix with proper wait
await closeButton.click()
await dialog.waitForHidden()
```

#### Rule: Handle Non-deterministic Element Order

When `getNodeRefsByType` returns multiple nodes, the order is not guaranteed. Don't use index `[0]` blindly.

```typescript
// ❌ Assumes order
const node = (await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode'))[0]

// ✅ Find by ID or proximity
const nodes = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
let target = nodes[0]
for (const n of nodes) {
  const pos = await n.getPosition()
  if (Math.abs(pos.y - expectedY) < minDist) target = n
}
```

Or guard the assumption:

```typescript
const nodes = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
expect(nodes).toHaveLength(1)
const node = nodes[0]
```

#### Rule: Use toPass for Timing-sensitive Dismiss Guards

Some UI elements (e.g. LiteGraph's graphdialog) have built-in dismiss delays. Retry the entire dismiss action:

```typescript
// ✅ Retry click+assert together
await expect(async () => {
  await comfyPage.canvas.click({ position: { x: 10, y: 10 } })
  await expect(dialog).toBeHidden({ timeout: 500 })
}).toPass({ timeout: 5000 })
```

### 4. Keep Changes Narrow

- Shared helpers should drive setup to a stable boundary.
- Do not encode one-spec timing assumptions into generic helpers.
- If a race only matters to one spec, prefer a local wait in that spec.
- If a helper fails before the real test begins, remove or relax the brittle precondition and let downstream UI interaction prove readiness.

### 5. Verify Narrowly

```bash
# Targeted rerun with repetition
pnpm test:browser:local -- browser_tests/tests/myFile.spec.ts --repeat-each 10

# Single test by line number (avoids grep quoting issues on Windows)
pnpm test:browser:local -- browser_tests/tests/myFile.spec.ts:42
```

- Use `--repeat-each 10` for targeted flake verification (use 20 for single test cases).
- Verify with the smallest command that exercises the flaky path.

### 6. Watch CI E2E Runs

After pushing, use `gh` to monitor the E2E workflow:

```bash
# Find the run for the current branch
gh run list --workflow="CI: Tests E2E" --branch=$(git branch --show-current) --limit=1

# Watch it live (blocks until complete, streams logs)
gh run watch <run-id>

# One-liner: find and watch the latest E2E run for the current branch
gh run list --workflow="CI: Tests E2E" --branch=$(git branch --show-current) --limit=1 --json databaseId --jq ".[0].databaseId" | xargs gh run watch
```

On Windows (PowerShell):

```powershell
# One-liner equivalent
gh run watch (gh run list --workflow="CI: Tests E2E" --branch=$(git branch --show-current) --limit=1 --json databaseId --jq ".[0].databaseId")
```

After the run completes:

```bash
# Download the Playwright report artifact
gh run download <run-id> -n playwright-report

# View the run summary in browser
gh run view <run-id> --web
```

Also watch the unit test workflow in parallel if you changed helpers:

```bash
gh run list --workflow="CI: Tests Unit" --branch=$(git branch --show-current) --limit=1
```

### 7. Pre-merge Checklist

Before merging a flaky-test fix, confirm:

- [ ] The latest CI artifact was inspected directly
- [ ] The root cause is stated as a race or readiness mismatch
- [ ] The fix waits on the real readiness boundary
- [ ] The assertion primitive matches the job (poll vs toHaveCount vs toPass)
- [ ] The fix stays local unless a shared helper truly owns the race
- [ ] Local verification uses a targeted rerun
- [ ] No behavioral changes to the test — only timing/retry strategy updated

## Local Noise — Do Not Fix

These are local distractions, not CI root causes:

- Missing local input fixture files required by the test path
- Missing local models directory
- Teardown `EPERM` while restoring the local browser-test user data directory
- Local screenshot baseline differences on Windows

Rules:

- First confirm whether it blocks the exact flaky path under investigation.
- Do not commit temporary local assets used only for verification.
- Do not commit local screenshot baselines.
