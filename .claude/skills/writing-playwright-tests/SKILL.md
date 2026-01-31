---
name: writing-playwright-tests
description: 'Writes Playwright e2e tests for ComfyUI_frontend. Use when creating, modifying, or debugging browser tests. Triggers on: playwright, e2e test, browser test, spec file.'
---

# Writing Playwright Tests for ComfyUI_frontend

## Golden Rules

1. **ALWAYS look at existing tests first.** Search `browser_tests/` for similar patterns before writing new tests.

2. **Use premade JSON workflow assets** instead of building workflows programmatically at runtime.
   - Assets live in `browser_tests/assets/`
   - Load with `await comfyPage.loadWorkflow('feature/my_workflow')`
   - More stable, faster, easier to debug
   - See [testing/assets.md](testing/assets.md) for details

## Vue Nodes vs LiteGraph: Which API?

**Choose your approach based on what you're testing:**

| Rendering Mode | When to Use | API Style |
|----------------|-------------|-----------|
| **Vue Nodes 2.0** | Testing Vue-rendered node UI, DOM widgets, CSS states | `comfyPage.vueNodes.*`, Playwright locators (`getByText`, `getByRole`) |
| **LiteGraph (Canvas)** | Testing canvas interactions, connections, legacy behavior | `comfyPage.getNodeRefByTitle()`, `NodeReference` methods |

### Vue Nodes 2.0
```typescript
await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
await comfyPage.vueNodes.waitForNodes()
const node = comfyPage.vueNodes.getNodeByTitle('KSampler')  // Returns Locator
await comfyPage.page.getByText('Load Checkpoint').click()
```
→ See [features/vue-nodes.md](features/vue-nodes.md)

### LiteGraph (Canvas)
```typescript
const node = comfyPage.getNodeRefByTitle('KSampler')  // Returns NodeReference
await node.click()
const slot = node.getOutputSlot('MODEL')
```
→ See [core/nodes.md](core/nodes.md) and [core/canvas.md](core/canvas.md)

## Quick Reference

| Task                      | Load This File                                     |
| ------------------------- | -------------------------------------------------- |
| **Start a new test**      | [core/setup.md](core/setup.md)                     |
| **Canvas interactions**   | [core/canvas.md](core/canvas.md)                   |
| **Node operations**       | [core/nodes.md](core/nodes.md)                     |
| **Widget testing**        | [testing/widgets.md](testing/widgets.md)           |
| **Vue Nodes 2.0**         | [features/vue-nodes.md](features/vue-nodes.md)     |
| **Commands/keybindings**  | [features/commands.md](features/commands.md)       |
| **Templates dialog**      | [features/templates.md](features/templates.md)     |
| **Workflow execution**    | [features/execution.md](features/execution.md)     |
| **File upload/drag-drop** | [testing/file-upload.md](testing/file-upload.md)   |
| **API mocking**           | [testing/mocking.md](testing/mocking.md)           |
| **Test assets**           | [testing/assets.md](testing/assets.md)             |
| **Debug flaky tests**     | [reference/debugging.md](reference/debugging.md)   |
| **Async retry patterns**  | [reference/debugging.md](reference/debugging.md#retry-patterns) |
| **All fixture methods**   | [reference/fixtures.md](reference/fixtures.md)     |
| **Quick cheatsheet**      | [reference/cheatsheet.md](reference/cheatsheet.md) |

## Running Tests

```bash
pnpm exec playwright test --ui          # UI mode (recommended)
pnpm exec playwright test --grep @smoke # Run by tag
pnpm test:browser:local                 # Local with traces
```

## Project Files

| Purpose           | Path                                  |
| ----------------- | ------------------------------------- |
| Main fixture      | `browser_tests/fixtures/ComfyPage.ts` |
| Test assets       | `browser_tests/assets/`               |
| Playwright config | `playwright.config.ts`                |
