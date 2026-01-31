# Node Patterns

> **⚠️ LiteGraph Mode:** These patterns apply to the default LiteGraph canvas rendering. For Vue Nodes 2.0 (DOM-based rendering), see [vue-nodes.md](../features/vue-nodes.md).
>
> | Mode | Node Access | Example |
> |------|-------------|---------|
> | LiteGraph | `comfyPage.getNodeRefByTitle()` | `node.click()`, `node.getWidget('seed')` |
> | Vue Nodes | `comfyPage.vueNodes.getNodeByTitle()` | Playwright locators, CSS classes |

## Getting Node References

### By Title (Preferred)

```typescript
// Stable across positions and reloads
const node = comfyPage.getNodeRefByTitle('KSampler')
```

### By ID

```typescript
// When you know the specific node ID
const node = comfyPage.getNodeRefById(5)
```

### First/Last Node

```typescript
const firstNode = comfyPage.getFirstNode()
const lastNode = comfyPage.getLastNode()
```

## Node Operations

### Click Node

```typescript
const node = comfyPage.getNodeRefByTitle('KSampler')
await node.click()
await comfyPage.nextFrame()
```

### Drag Node

```typescript
const node = comfyPage.getNodeRefByTitle('KSampler')
await node.drag({ x: 100, y: 50 })
await comfyPage.nextFrame()
```

### Collapse/Expand

```typescript
await node.collapse()
await comfyPage.nextFrame()

await node.expand()
await comfyPage.nextFrame()

// Assert state
await expect(node).toBeCollapsed()
```

### Bypass

```typescript
await node.bypass()
await comfyPage.nextFrame()

// Assert state
await expect(node).toBeBypassed()
```

### Pin

```typescript
await node.pin()
await comfyPage.nextFrame()

// Assert state
await expect(node).toBePinned()
```

### Delete

```typescript
await node.click()
await comfyPage.canvas.focus()
await comfyPage.page.keyboard.press('Delete')
await comfyPage.nextFrame()
```

## Slots (Inputs/Outputs)

### Get Slot Reference

```typescript
// Output slot
const outputSlot = node.getOutputSlot('MODEL')

// Input slot
const inputSlot = node.getInputSlot('model')
```

### Get Slot Position

```typescript
const position = await outputSlot.getPosition()
// { x: number, y: number }
```

### Connect Slots

```typescript
const sourceNode = comfyPage.getNodeRefByTitle('Load Checkpoint')
const targetNode = comfyPage.getNodeRefByTitle('KSampler')

const outputSlot = sourceNode.getOutputSlot('MODEL')
const inputSlot = targetNode.getInputSlot('model')

await comfyMouse.dragFromTo(
  await outputSlot.getPosition(),
  await inputSlot.getPosition(),
  { steps: 10 }
)
await comfyPage.nextFrame()
```

## Widgets

### Get Widget

```typescript
const widget = node.getWidget('seed')
const stepsWidget = node.getWidget('steps')
```

### Set Widget Value

```typescript
await widget.setValue(12345)
await comfyPage.nextFrame()
```

### Get Widget Value

```typescript
const value = await widget.getValue()
expect(value).toBe(12345)
```

### Widget Types

See [patterns/widgets.md](widgets.md) for type-specific patterns.

## Node Assertions

```typescript
// Visibility
await expect(node.locator).toBeVisible()

// States (custom matchers)
await expect(node).toBeCollapsed()
await expect(node).toBeBypassed()
await expect(node).toBePinned()
```

## Example: Complete Node Test

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('Node Operations', { tag: ['@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('nodes/basic')
    await comfyPage.nextFrame()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.resetView()
  })

  test('collapses and expands node', async ({ comfyPage }) => {
    const node = comfyPage.getNodeRefByTitle('KSampler')

    await node.collapse()
    await comfyPage.nextFrame()
    await expect(node).toBeCollapsed()

    await node.expand()
    await comfyPage.nextFrame()
    await expect(node).not.toBeCollapsed()
  })

  test('connects two nodes', async ({ comfyPage }) => {
    const source = comfyPage.getNodeRefByTitle('Load Checkpoint')
    const target = comfyPage.getNodeRefByTitle('KSampler')

    await comfyMouse.dragFromTo(
      await source.getOutputSlot('MODEL').getPosition(),
      await target.getInputSlot('model').getPosition(),
      { steps: 10 }
    )
    await comfyPage.nextFrame()

    // Verify connection via screenshot or workflow state
    await expect(comfyPage.canvas).toHaveScreenshot('connected.png')
  })
})
```
