# Test Setup Patterns

## Essential Imports

```typescript
// ALWAYS use these custom fixtures - never vanilla Playwright
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'
```

## Quick Start Template

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('FeatureName', { tag: ['@screenshot', '@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('should do something', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('myWorkflow')
    await comfyPage.nextFrame()

    // Test logic here

    await expect(comfyPage.canvas).toHaveScreenshot('expected.png')
  })
})
```

## Test Tags

Add appropriate tags to every test:

| Tag           | When to Use             |
| ------------- | ----------------------- |
| `@smoke`      | Quick essential tests   |
| `@slow`       | Tests > 10 seconds      |
| `@screenshot` | Visual regression tests |
| `@canvas`     | Canvas interactions     |
| `@node`       | Node-related            |
| `@widget`     | Widget-related          |
| `@mobile`     | Mobile viewport tests   |

```typescript
test.describe('Feature', { tag: ['@screenshot', '@canvas'] }, () => {
```

## Common Settings

```typescript
// Menu mode
await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')

// Vue Nodes 2.0
await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)

// UI elements
await comfyPage.setSetting('Comfy.Minimap.Visible', false)
await comfyPage.setSetting('Comfy.Graph.CanvasMenu', true)

// Warnings
await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', false)

// Locale
await comfyPage.setSetting('Comfy.Locale', 'fr')
```

## Loading Workflows

```typescript
// Load from browser_tests/assets/
await comfyPage.loadWorkflow('widgets/combo_widget')
await comfyPage.nextFrame()

// Always use premade workflows, don't create programmatically
```

## Common Gotchas

See [debugging.md](../reference/debugging.md) for detailed fixes.

| Issue | Solution | Details |
|-------|----------|---------|
| Canvas not updating | Add `nextFrame()` after canvas ops | [canvas.md](canvas.md#critical-always-use-nextframe) |
| Double-click unreliable | Use `{ delay: 5 }` option | [canvas.md](canvas.md#click-operations) |
| Screenshot mismatch | Linux-only, use PR label | [debugging.md](../reference/debugging.md#debugging-screenshots) |
| Keyboard not working | Focus canvas first | [canvas.md](canvas.md#focus-before-keyboard) |
| Flaky async assertions | Use `expect.poll()` or `toPass()` | [debugging.md](../reference/debugging.md#retry-patterns) |

## Fresh Page Setup

For tests that need clean state:

```typescript
test('first-time user experience', async ({ comfyPage }) => {
  await comfyPage.setup({ clearStorage: true })
  // localStorage/sessionStorage cleared
})
```
