# Asset Patterns

## Why Use Assets

**Always prefer pre-made workflow assets over programmatic workflow creation.**

Benefits:

- Stable, reproducible test state
- Faster test execution
- Easier to debug (open asset in ComfyUI)
- Less fragile than runtime creation

## Asset Directory Structure

```
browser_tests/assets/
├── default.json              # Basic empty workflow
├── canvas/                   # Canvas state tests
│   ├── pan_zoom.json
│   └── selection.json
├── groups/                   # Group-related
│   ├── basic_group.json
│   └── nested_groups.json
├── nodes/                    # Node-specific
│   ├── reroute.json
│   ├── primitive.json
│   └── bypass.json
├── widgets/                  # Widget tests
│   ├── combo_widget.json
│   ├── slider_widget.json
│   └── text_widget.json
├── workflows/                # Complex scenarios
│   ├── img2img.json
│   ├── inpainting.json
│   └── controlnet.json
└── images/                   # Image files for drag-drop
    ├── test_image.png
    └── mask.png
```

## Creating New Assets

### 1. Build in ComfyUI

1. Open ComfyUI
2. Create the workflow state you need
3. Set up nodes, connections, widget values

### 2. Export as JSON

1. Click workflow menu → Save (API Format)
2. Or use developer console: `app.graphToPrompt()`

### 3. Save to Assets

```bash
# Save to appropriate subdirectory
mv workflow.json browser_tests/assets/feature/my_workflow.json
```

### 4. Use in Test

```typescript
await comfyPage.loadWorkflow('feature/my_workflow')
```

## Loading Assets

### Basic Load

```typescript
// Loads browser_tests/assets/myWorkflow.json
await comfyPage.loadWorkflow('myWorkflow')
await comfyPage.nextFrame()
```

### With Path

```typescript
// From subdirectory
await comfyPage.loadWorkflow('widgets/combo_widget')
```

### Default Workflow

```typescript
// Load the basic starting workflow
await comfyPage.loadWorkflow('default')
```

## Image Assets

For drag-and-drop tests:

```typescript
await comfyPage.dragAndDropFile('browser_tests/assets/images/test_image.png', {
  x: 100,
  y: 100
})
await comfyPage.nextFrame()
```

## Asset Best Practices

### 1. Keep Assets Minimal

Only include nodes needed for the test. Avoid complex workflows unless testing complexity.

### 2. Use Descriptive Names

```
❌ test1.json
✅ slider_widget_with_min_max.json
```

### 3. Organize by Feature

```
assets/widgets/       # All widget tests
assets/nodes/         # Node-specific tests
assets/canvas/        # Canvas interaction tests
```

### 4. Document Non-Obvious Assets

Add a comment at the top of the JSON or a README in the subdirectory:

```json
{
  "_comment": "Workflow with 3 nodes connected in series for connection tests",
  "nodes": [...]
}
```

### 5. Version Control Assets

Assets are committed to git. Changes should be reviewed like code.

## Finding Existing Assets

```bash
# List all assets
find browser_tests/assets -name "*.json" | head -20

# Search by content
grep -r "KSampler" browser_tests/assets/

# Find assets used by a test
grep -r "loadWorkflow" browser_tests/*.spec.ts
```

## Example: Asset-Based Test

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('Combo Widget', { tag: ['@widget'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Load premade asset instead of building workflow
    await comfyPage.loadWorkflow('widgets/combo_widget')
    await comfyPage.nextFrame()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.resetView()
  })

  test('changes combo selection', async ({ comfyPage }) => {
    const node = comfyPage.getNodeRefByTitle('KSampler')
    const widget = node.getWidget('sampler_name')

    await widget.click()
    await comfyPage.page.getByRole('option', { name: 'euler' }).click()
    await comfyPage.nextFrame()

    const value = await widget.getValue()
    expect(value).toBe('euler')
  })
})
```
