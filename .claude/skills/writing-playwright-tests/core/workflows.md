# Workflow Patterns

## Loading Workflows

### From Assets (Preferred)

```typescript
// Loads browser_tests/assets/myWorkflow.json
await comfyPage.loadWorkflow('myWorkflow')

// Subdirectories supported
await comfyPage.loadWorkflow('widgets/combo_widget')
await comfyPage.loadWorkflow('nodes/reroute')
await comfyPage.loadWorkflow('canvas/pan_zoom')
```

### Asset Organization

See [assets.md](../testing/assets.md) for full directory structure and best practices.

### Creating New Assets

1. Build the workflow in ComfyUI UI
2. Export as JSON
3. Save to appropriate `assets/` subdirectory
4. Reference by path (without `.json`)

## Workflow State

### Check Current Workflow

```typescript
const workflow = await comfyPage.getWorkflow()
expect(workflow.nodes.length).toBe(3)
```

### Reset Workflow

```typescript
// In afterEach to prevent test pollution
test.afterEach(async ({ comfyPage }) => {
  await comfyPage.resetView()
})
```

### Clear Workflow

```typescript
await comfyPage.page.keyboard.press('Control+a')
await comfyPage.page.keyboard.press('Delete')
await comfyPage.nextFrame()
```

## Workflow Validation

```typescript
// Check node count
const nodes = await comfyPage.getNodes()
expect(nodes.length).toBe(5)

// Check specific node exists
const node = comfyPage.getNodeRefByTitle('KSampler')
await expect(node.locator).toBeVisible()
```

## Example: Complete Workflow Test

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('Workflow Operations', { tag: ['@workflow'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.resetView()
  })

  test('loads workflow from asset', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/slider_widget')
    await comfyPage.nextFrame()

    const node = comfyPage.getNodeRefByTitle('Preview Image')
    await expect(node.locator).toBeVisible()
  })
})
```
