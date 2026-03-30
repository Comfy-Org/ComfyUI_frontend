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

## Reference Documentation

Before transforming, read these existing docs for full context:

| Document | What it covers |
| --- | --- |
| `docs/guidance/playwright.md` | Playwright conventions, type assertions, assertion best practices, tags |
| `browser_tests/AGENTS.md` | Directory structure, polling assertions, gotchas, quality checks |
| `browser_tests/fixtures/ComfyPage.ts` | Main fixture API (source of truth for all helpers) |
| `browser_tests/fixtures/helpers/` | Focused helper classes (canvas, keyboard, workflow, etc.) |

## Transform Rules

The programmatic transform engine lives in `tools/test-recorder/src/transform/rules.ts`. Apply these replacements in order:

| Raw codegen | Convention replacement | Why |
| --- | --- | --- |
| `import { test, expect } from '@playwright/test'` | `import { comfyPageFixture as test, comfyExpect as expect } from '../fixtures/ComfyPage'` | Use custom fixtures with ComfyUI helpers |
| `test('test', async ({ page }) =>` | `test('descriptive-name', async ({ comfyPage }) =>` | Use comfyPage fixture, descriptive names |
| `await page.goto('http://...')` | **Remove entirely** | Fixture handles navigation automatically |
| `page.locator('canvas')` | `comfyPage.canvas` | Pre-configured canvas locator |
| `page.waitForTimeout(N)` | `comfyPage.nextFrame()` | Never use arbitrary waits |
| `page.getByPlaceholder('Search Nodes...')` | `comfyPage.searchBox.input` | Use search box page object |
| `page` (bare reference) | `comfyPage.page` | Access raw page through fixture |
| Bare `test(...)` | `test.describe('Feature', { tag: ['@canvas'] }, () => { test(...) })` | All tests need describe + tags |
| No cleanup | Add `test.afterEach(async ({ comfyPage }) => { await comfyPage.canvasOps.resetView() })` | Canvas tests need cleanup |

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

## Decision Guide

| Question | Answer |
| --- | --- |
| Canvas or DOM interaction? | Canvas: `comfyPage.nodeOps.*`. DOM: `comfyPage.vueNodes.*` (needs opt-in) |
| Need `nextFrame()`? | Yes after canvas mutations. No after `loadWorkflow()`, no after DOM clicks |
| Which tag? | `@canvas` for canvas tests, `@widget` for widget tests, `@screenshot` for visual regression |
| Need cleanup? | Yes for canvas tests (`resetView`), yes if changing settings (`setSetting` back) |
| Keep pixel coords? | Only for empty canvas clicks. Replace with node refs for node interactions |
| Use `page` directly? | Only via `comfyPage.page` for Playwright APIs not wrapped by fixtures |

## Anti-Patterns

1. **Never use `waitForTimeout`** → use `nextFrame()` or retrying assertions
2. **Never use `page.goto`** → fixture handles navigation
3. **Never import from `@playwright/test`** → use `../fixtures/ComfyPage`
4. **Never use bare CSS selectors** → use test IDs or semantic locators
5. **Never share state between tests** → each test is independent
6. **Never commit local screenshots** → Linux CI generates baselines

## For Deeper Reference

Read fixture code directly — it's the source of truth:

| Purpose | Path |
| --- | --- |
| Main fixture | `browser_tests/fixtures/ComfyPage.ts` |
| Helper classes | `browser_tests/fixtures/helpers/` |
| Component objects | `browser_tests/fixtures/components/` |
| Test selectors | `browser_tests/fixtures/selectors.ts` |
| Vue Node helpers | `browser_tests/fixtures/VueNodeHelpers.ts` |
| Existing tests | `browser_tests/tests/` |
| Test assets | `browser_tests/assets/` |
