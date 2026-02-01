# Vue Nodes 2.0 Patterns

Vue Nodes 2.0 is an alternative rendering mode for nodes. Tests need to explicitly enable it.

> **📋 This file covers Vue Nodes equivalents for:**
>
> - Canvas interactions → [LiteGraph version](../core/canvas.md)
> - Node operations → [LiteGraph version](../core/nodes.md)
> - Widget testing → [LiteGraph version](../testing/widgets.md)
>
> Vue Nodes uses **DOM elements** instead of canvas drawing. Test with Playwright locators, not coordinate-based clicks.

## Enabling Vue Nodes

```typescript
test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.vueNodes.waitForNodes()
})
```

## VueNodeHelpers API

Access via `comfyPage.vueNodes`:

```typescript
// Get node by title
const node = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')

// Get node count
const count = await comfyPage.vueNodes.getNodeCount()

// Get selected node count
const selectedCount = await comfyPage.vueNodes.getSelectedNodeCount()

// Wait for nodes to render
await comfyPage.vueNodes.waitForNodes()
await comfyPage.vueNodes.waitForNodes(5) // Wait for at least 5 nodes

// Enter a subgraph
await comfyPage.vueNodes.enterSubgraph()
```

## Selecting Vue Nodes

```typescript
// Click node by title (header text)
await comfyPage.page.getByText('Load Checkpoint').click()

// Multi-select with modifier keys
await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })

// Select all with keyboard
await comfyPage.canvas.press('Control+a')
```

## Node State Testing

Vue Nodes use CSS classes to indicate state:

```typescript
// Bypass state
const BYPASS_CLASS = /before:bg-bypass\/60/
const node = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
await expect(node).toHaveClass(BYPASS_CLASS)

// Selection state (outline)
await expect(node).toHaveClass(/outline-node-component-outline/)
```

## Vue Node Hotkeys

```typescript
await comfyPage.page.getByText('Load Checkpoint').click()
await comfyPage.page.keyboard.press('Control+b') // Bypass
await comfyPage.page.keyboard.press('p') // Pin
await comfyPage.page.keyboard.press('m') // Mute
```

## DOM-based Widget Access

Vue Nodes use DOM elements instead of canvas rendering:

```typescript
// Get widget by name
const widget = comfyPage.vueNodes.getWidgetByName('KSampler', 'seed')

// Get input number controls
const controls = comfyPage.vueNodes.getInputNumberControls(widget)
await controls.incrementButton.click()
await controls.decrementButton.click()
await controls.input.fill('42')

// Widget reactivity test pattern
const widgetLocator = comfyPage.page.locator(
  'css=[data-testid="node-body-4"] > .lg-node-widgets > div'
)
await expect(widgetLocator).toHaveCount(2)
```

## VueNodeFixture Pattern

For more complex DOM interactions:

```typescript
const fixture = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
// Fixture maintains stable reference even if title changes
```

## Vue Nodes Settings

The essential setting for Vue Nodes:

```typescript
await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
```

See [setup.md](../core/setup.md#common-settings) for other common settings.

## Example: Complete Vue Node Test

```typescript
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

test.describe('Vue Node Feature', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should toggle bypass state', async ({ comfyPage }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.keyboard.press('Control+b')

    const node = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    await expect(node).toHaveClass(/before:bg-bypass\/60/)
  })
})
```
