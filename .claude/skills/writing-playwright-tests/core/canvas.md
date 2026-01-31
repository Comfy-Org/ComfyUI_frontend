# Canvas Interaction Patterns

## Critical: Always Use nextFrame()

Canvas changes don't render immediately. **Always** call `nextFrame()` after canvas operations:

```typescript
await comfyPage.canvas.click(100, 200)
await comfyPage.nextFrame() // ← Required!
```

## Focus Before Keyboard

```typescript
await comfyPage.canvas.focus() // Required before any keyboard events
await comfyPage.page.keyboard.press('Control+a')
```

## Click Operations

```typescript
// Basic click
await comfyPage.canvas.click(x, y)
await comfyPage.nextFrame()

// Right-click (context menu)
await comfyPage.canvas.click(x, y, { button: 'right' })
await comfyPage.nextFrame()

// Double-click (add delay for reliability)
await comfyPage.canvas.dblclick(x, y, { delay: 5 })
await comfyPage.nextFrame()
```

## Drag Operations

Use `comfyMouse` fixture for reliable drags:

```typescript
// Basic drag
await comfyMouse.dragFromTo(
  { x: 100, y: 100 },
  { x: 300, y: 300 },
  { steps: 10 } // steps prevents flakiness
)
await comfyPage.nextFrame()

// Drag node
const node = comfyPage.getNodeRefByTitle('KSampler')
await node.drag({ x: 50, y: 50 })
await comfyPage.nextFrame()
```

## Pan and Zoom

```typescript
// Pan the canvas
await comfyPage.pan({ x: 100, y: 100 })
await comfyPage.nextFrame()

// Zoom
await comfyPage.zoom(1.5) // 150%
await comfyPage.nextFrame()

// Reset view
await comfyPage.resetView()
await comfyPage.nextFrame()
```

## Selection

```typescript
// Select all
await comfyPage.canvas.focus()
await comfyPage.page.keyboard.press('Control+a')
await comfyPage.nextFrame()

// Box select (marquee)
await comfyMouse.dragFromTo({ x: 0, y: 0 }, { x: 500, y: 500 })
await comfyPage.nextFrame()
```

## Connecting Nodes

See [nodes.md](nodes.md#connect-slots) for node connection patterns.

## Screenshot Testing

```typescript
// Full canvas screenshot
await expect(comfyPage.canvas).toHaveScreenshot('canvas-state.png')

// With masking
await expect(comfyPage.canvas).toHaveScreenshot('masked.png', {
  mask: [comfyPage.page.locator('.timestamp')]
})
```

## Example: Complete Canvas Test

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('Canvas Operations', { tag: ['@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.resetView()
  })

  test('pans and zooms canvas', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')
    await comfyPage.nextFrame()

    // Pan
    await comfyPage.pan({ x: 100, y: 50 })
    await comfyPage.nextFrame()

    // Zoom
    await comfyPage.zoom(1.2)
    await comfyPage.nextFrame()

    // Verify canvas state
    await expect(comfyPage.canvas).toHaveScreenshot('panned-zoomed.png')
  })
})
```
