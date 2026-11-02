---
name: codegen-transform
description: 'Transforms raw Playwright codegen output into ComfyUI convention-compliant tests. Use when: user pastes raw codegen, asks to convert raw Playwright code, refactor recorded tests, or rewrite to project conventions. Triggers on: transform codegen, convert raw test, rewrite to conventions, codegen output, raw playwright.'
---

# Codegen → Convention Transform

Turn raw Playwright codegen output (from `pnpm comfy-test record` or
`playwright codegen`) into a spec that follows `docs/guidance/playwright.md`.

1. Run the mechanical pass first:

   ```bash
   pnpm comfy-test transform <name>.raw.spec.ts [--name <n>] [--tags <a,b>] [--workflow <w>]
   ```

   The output goes to `<name>.spec.ts`; for any other input name, pass
   `--output <path>`.

   The rules live in `tools/test-recorder/src/transform/rules.ts`: the
   `comfyPageFixture` import, the `comfyPage` fixture, removing `page.goto`,
   `comfyPage.canvas`, `comfyPage.searchBox`, replacing `waitForTimeout`, and the
   tagged `test.describe` wrapper. Read that file instead of re-applying the
   rules by hand.

2. Then do what the engine cannot: apply `docs/guidance/playwright.md` to the
   result. Most of the remaining work is replacing recorded coordinates.

## Canvas coordinates → node references

Codegen records pixel positions. Replace each click on a node with a node
reference:

```typescript
// Raw codegen
await page.locator('canvas').click({ position: { x: 423, y: 267 } })

// Clicking a specific node
const node = await comfyPage.nodeOps.getNodeRefById(3)
await node.click('title')

// Double-clicking empty canvas to open search
await comfyPage.canvas.dblclick({ position: { x: 500, y: 400 } })
await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')
```

Keep coordinates only for empty-canvas clicks, pans, and zooms. Find node IDs
in the workflow asset the recording loaded from `browser_tests/assets/`.

Keep the recorded actions and assertions; change structure and style only. Say
which recorded action you dropped or rewrote, and why.
