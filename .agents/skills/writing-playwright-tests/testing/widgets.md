# Widget Patterns

## Getting Widgets

```typescript
const node = comfyPage.getNodeRefByTitle('KSampler')
const widget = node.getWidget('seed')
```

## Widget Types

### Number Widgets (INT, FLOAT)

```typescript
const seedWidget = node.getWidget('seed')
await seedWidget.setValue(12345)
const value = await seedWidget.getValue()
```

### Combo/Dropdown Widgets

```typescript
const samplerWidget = node.getWidget('sampler_name')
await samplerWidget.setValue('euler')

// Or click to open dropdown
await samplerWidget.click()
await comfyPage.page.getByText('euler_ancestral').click()
await comfyPage.nextFrame()
```

### String/Text Widgets

```typescript
const promptWidget = node.getWidget('text')
await promptWidget.setValue('a beautiful landscape')
```

### Toggle/Boolean Widgets

```typescript
const toggleWidget = node.getWidget('enable')
await toggleWidget.setValue(true)
// or
await toggleWidget.click()
await comfyPage.nextFrame()
```

### Slider Widgets

```typescript
const sliderWidget = node.getWidget('denoise')
await sliderWidget.setValue(0.75)
```

## Widget Value Assertions

```typescript
const widget = node.getWidget('steps')
const value = await widget.getValue()
expect(value).toBe(20)
```

## Widget Visibility

```typescript
// Check widget is visible
await expect(widget.locator).toBeVisible()

// Widget might be hidden when node is collapsed
await node.expand()
await comfyPage.nextFrame()
await expect(widget.locator).toBeVisible()
```

## Common Widget Gotchas

### 1. Wait for Value Change

Widget values may not update instantly:

```typescript
await widget.setValue(100)
await comfyPage.nextFrame()

// Retry assertion
await expect(async () => {
  const value = await widget.getValue()
  expect(value).toBe(100)
}).toPass({ timeout: 2000 })
```

### 2. Combo Widget Selection

Click-based selection is more reliable than setValue for combos:

```typescript
await samplerWidget.click()
await comfyPage.page.getByRole('option', { name: 'euler' }).click()
await comfyPage.nextFrame()
```

### 3. Widget Focus

Some widgets need focus before input:

```typescript
await widget.locator.click()
await widget.locator.fill('new value')
await comfyPage.nextFrame()
```

## Example: Complete Widget Test

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('Widget Operations', { tag: ['@widget'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.loadWorkflow('widgets/all_types')
    await comfyPage.nextFrame()
  })

  test('sets number widget value', async ({ comfyPage }) => {
    const node = comfyPage.getNodeRefByTitle('KSampler')
    const seedWidget = node.getWidget('seed')

    await seedWidget.setValue(42)
    await comfyPage.nextFrame()

    const value = await seedWidget.getValue()
    expect(value).toBe(42)
  })

  test('selects combo option', async ({ comfyPage }) => {
    const node = comfyPage.getNodeRefByTitle('KSampler')
    const samplerWidget = node.getWidget('sampler_name')

    await samplerWidget.click()
    await comfyPage.page.getByRole('option', { name: 'dpmpp_2m' }).click()
    await comfyPage.nextFrame()

    const value = await samplerWidget.getValue()
    expect(value).toBe('dpmpp_2m')
  })
})
```

## Asset Workflows for Widget Testing

Pre-made workflows for widget tests:

- `assets/widgets/combo_widget.json`
- `assets/widgets/slider_widget.json`
- `assets/widgets/text_widget.json`
- `assets/widgets/number_widget.json`
