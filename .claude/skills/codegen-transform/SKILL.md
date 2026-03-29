---
name: codegen-transform
description: 'Transforms raw Playwright codegen output into ComfyUI convention-compliant tests. Use when: user pastes raw codegen, asks to convert raw Playwright code, refactor recorded tests, or rewrite to project conventions. Triggers on: transform codegen, convert raw test, rewrite to conventions, codegen output, raw playwright.'
---

# Codegen → Convention Transform

Transform raw Playwright codegen output into tests that follow ComfyUI conventions.

## When to Use

- QA tester recorded a test with `pnpm comfy-test record` and wants refinement
- Developer pasted raw `npx playwright codegen` output
- Agent needs to post-process Playwright test agent output
- Reviewing a test that uses raw `page.*` calls instead of fixture helpers

## Transform Rules

Apply these replacements in order:

| Raw codegen                                       | Convention replacement                                                                    | Why                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| `import { test, expect } from '@playwright/test'` | `import { comfyPageFixture as test, comfyExpect as expect } from '../fixtures/ComfyPage'` | Use custom fixtures with ComfyUI helpers |
| `test('test', async ({ page }) =>`                | `test('descriptive-name', async ({ comfyPage }) =>`                                       | Use comfyPage fixture, descriptive names |
| `await page.goto('http://...')`                   | **Remove entirely**                                                                       | Fixture handles navigation automatically |
| `page.locator('canvas')`                          | `comfyPage.canvas`                                                                        | Pre-configured canvas locator            |
| `page.waitForTimeout(N)`                          | `comfyPage.nextFrame()`                                                                   | Never use arbitrary waits                |
| `page.getByPlaceholder('Search Nodes...')`        | `comfyPage.searchBox.input`                                                               | Use search box page object               |
| `page` (bare reference)                           | `comfyPage.page`                                                                          | Access raw page through fixture          |
| Bare `test(...)`                                  | `test.describe('Feature', { tag: ['@canvas'] }, () => { test(...) })`                     | All tests need describe + tags           |
| No cleanup                                        | Add `test.afterEach(async ({ comfyPage }) => { await comfyPage.canvasOps.resetView() })`  | Canvas tests need cleanup                |

## Fixture API Quick Reference

| Need              | Use                                               | Notes                                                         |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Canvas element    | `comfyPage.canvas`                                | Pre-configured Locator                                        |
| Wait for render   | `comfyPage.nextFrame()`                           | After canvas mutations. NOT needed after `loadWorkflow()`     |
| Load workflow     | `comfyPage.workflow.loadWorkflow('name')`         | Assets in `browser_tests/assets/`                             |
| Get node by type  | `comfyPage.nodeOps.getNodeRefsByType('KSampler')` | Returns array of NodeReference                                |
| Get node by title | `comfyPage.nodeOps.getNodeRefsByTitle('My Node')` | Returns array of NodeReference                                |
| Search box        | `comfyPage.searchBox`                             | Has `.input`, `.fillAndSelectFirstNode()`                     |
| Settings          | `comfyPage.settings.setSetting(key, value)`       | Persistent — clean up in afterEach                            |
| Keyboard          | `comfyPage.keyboard.press('Delete')`              | Focus canvas first                                            |
| Drag & drop       | `comfyPage.dragDrop.*`                            | Use `{ steps: 10 }` for reliability                           |
| Context menu      | `comfyPage.contextMenu.*`                         | Right-click interactions                                      |
| Toast messages    | `comfyPage.toast.*`                               | Notification assertions                                       |
| Subgraph          | `comfyPage.subgraph.*`                            | Subgraph/group node operations                                |
| Vue Nodes         | `comfyPage.vueNodes.*`                            | Requires opt-in: `setSetting('Comfy.VueNodes.Enabled', true)` |
| Mouse ops         | `comfyPage.page` + `ComfyMouse`                   | For precise canvas mouse interactions                         |
| Bottom panel      | `comfyPage.bottomPanel.*`                         | Job queue, logs panel                                         |
| Commands          | `comfyPage.command.*`                             | Command palette interactions                                  |
| Clipboard         | `comfyPage.clipboard.*`                           | Copy/paste operations                                         |

## Canvas Coordinates → Node References

Raw codegen records fragile pixel coordinates. Replace with node references when possible:

```typescript
// ❌ Raw codegen — fragile pixel coordinates
await page.locator('canvas').click({ position: { x: 423, y: 267 } })

// ✅ If clicking a specific node
const node = (await comfyPage.nodeOps.getNodeRefsByType('KSampler'))[0]
await node.click('title')

// ✅ If double-clicking canvas to open search
await comfyPage.canvas.dblclick({ position: { x: 500, y: 400 } })
await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')
```

**When to keep coordinates**: Canvas background clicks (pan, zoom), empty area clicks to deselect. These are inherently position-based.

## Complete Before/After Example

### Raw codegen output

```typescript
import { test, expect } from '@playwright/test'

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/')
  await page.locator('canvas').dblclick({ position: { x: 500, y: 400 } })
  await page.getByPlaceholder('Search Nodes...').fill('KSampler')
  await page.getByPlaceholder('Search Nodes...').press('Enter')
  await page.locator('canvas').click({ position: { x: 600, y: 300 } })
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Queue' }).click()
})
```

### Convention-compliant output

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Queue workflow with KSampler', { tag: ['@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('should add KSampler node and queue', async ({ comfyPage }) => {
    // Open search and add KSampler
    await comfyPage.canvas.dblclick({ position: { x: 500, y: 400 } })
    await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')
    await comfyPage.nextFrame()

    // Queue the workflow
    await comfyPage.menu.topbar.runButton.click()
  })
})
```

### What changed and why

1. **Imports**: `@playwright/test` → `../fixtures/ComfyPage` (custom fixtures)
2. **Fixture**: `{ page }` → `{ comfyPage }` (access all helpers)
3. **goto removed**: Fixture navigates automatically
4. **Search box**: Raw locator → `comfyPage.searchBox.fillAndSelectFirstNode()`
5. **waitForTimeout**: Replaced with `comfyPage.nextFrame()`
6. **Queue button**: Used `comfyPage.menu.topbar.runButton` page object
7. **Structure**: Wrapped in `describe` with `@canvas` tag and `afterEach` cleanup
8. **Test name**: Generic "test" → descriptive name

## Decision Guide

| Question                   | Answer                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Canvas or DOM interaction? | Canvas: `comfyPage.nodeOps.*`. DOM: `comfyPage.vueNodes.*` (needs opt-in)                   |
| Need `nextFrame()`?        | Yes after canvas mutations. No after `loadWorkflow()`, no after DOM clicks                  |
| Which tag?                 | `@canvas` for canvas tests, `@widget` for widget tests, `@screenshot` for visual regression |
| Need cleanup?              | Yes for canvas tests (`resetView`), yes if changing settings (`setSetting` back)            |
| Keep pixel coords?         | Only for empty canvas clicks. Replace with node refs for node interactions                  |
| Use `page` directly?       | Only via `comfyPage.page` for Playwright APIs not wrapped by fixtures                       |

## Tags Reference

| Tag           | When to use                          |
| ------------- | ------------------------------------ |
| `@canvas`     | Any test interacting with the canvas |
| `@widget`     | Testing widget inputs                |
| `@smoke`      | Quick essential tests                |
| `@screenshot` | Visual regression (Linux CI only)    |
| `@mobile`     | Mobile viewport (runs on Pixel 5)    |
| `@2x`         | HiDPI tests (2x scale)               |
| `@0.5x`       | Low-DPI tests (0.5x scale)           |
| `@slow`       | Tests taking >10 seconds             |
| `@perf`       | Performance measurement tests        |

## Anti-Patterns

1. **Never use `waitForTimeout`** → use `nextFrame()` or retrying assertions
2. **Never use `page.goto`** → fixture handles navigation
3. **Never import from `@playwright/test`** → use `../fixtures/ComfyPage`
4. **Never use bare CSS selectors** → use test IDs or semantic locators
5. **Never share state between tests** → each test is independent
6. **Never commit local screenshots** → Linux CI generates baselines

## For Deeper Reference

Read fixture code directly — it's the source of truth:

| Purpose           | Path                                       |
| ----------------- | ------------------------------------------ |
| Main fixture      | `browser_tests/fixtures/ComfyPage.ts`      |
| Helper classes    | `browser_tests/fixtures/helpers/`          |
| Component objects | `browser_tests/fixtures/components/`       |
| Test selectors    | `browser_tests/fixtures/selectors.ts`      |
| Vue Node helpers  | `browser_tests/fixtures/VueNodeHelpers.ts` |
| Existing tests    | `browser_tests/tests/`                     |
| Test assets       | `browser_tests/assets/`                    |
