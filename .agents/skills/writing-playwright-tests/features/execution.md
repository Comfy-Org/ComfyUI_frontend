# Execution & Workflow Testing Patterns

Testing workflow execution and reading results.

## Queueing Prompts

```typescript
await comfyPage.executeCommand('Comfy.QueuePrompt')
```

## Testing Execution Errors

```typescript
test('Report error on unconnected slot', async ({ comfyPage }) => {
  await comfyPage.disconnectEdge()
  await comfyPage.clickEmptySpace()

  await comfyPage.executeCommand('Comfy.QueuePrompt')
  await expect(comfyPage.page.locator('.comfy-error-report')).toBeVisible()

  // Dismiss error dialog
  await comfyPage.page.locator('.p-dialog-close-button').click()
  await comfyPage.page.locator('.comfy-error-report').waitFor({
    state: 'hidden'
  })
})
```

## Partial Execution (Selected Outputs)

```typescript
test('Execute to selected output nodes', async ({ comfyPage }) => {
  await comfyPage.loadWorkflow('execution/partial_execution')

  const input = await comfyPage.getNodeRefById(3)
  const output1 = await comfyPage.getNodeRefById(1)
  const output2 = await comfyPage.getNodeRefById(4)

  // Select only output1
  await output1.click('title')

  // Execute selected outputs only
  await comfyPage.executeCommand('Comfy.QueueSelectedOutputNodes')

  // Wait for execution with retry
  await expect(async () => {
    expect(await (await output1.getWidget(0)).getValue()).toBe('foo')
    expect(await (await output2.getWidget(0)).getValue()).toBe('')
  }).toPass({ timeout: 2_000 })
})
```

## Reading Node Outputs

```typescript
// Access node outputs programmatically
await comfyPage.page.evaluate(
  ([loadId, saveId]) => {
    // Set output of save node to equal loader node's image
    window['app'].nodeOutputs[saveId] = window['app'].nodeOutputs[loadId]
    app.canvas.setDirty(true)
  },
  [loadNodeId, saveNodeId]
)
```

## Simulating Execution Results

For testing UI responses without actual execution:

```typescript
// Inject fake output data
await comfyPage.page.evaluate((nodeId) => {
  window['app'].nodeOutputs[nodeId] = {
    images: [{ filename: 'test.png', subfolder: '', type: 'output' }]
  }
  app.canvas.setDirty(true)
}, nodeId)
```

## Waiting for Execution

Use retry assertions for async execution results:

```typescript
await expect(async () => {
  const value = await widget.getValue()
  expect(value).toBe('expected_result')
}).toPass({ timeout: 2_000 })
```

## Testing Widget Callbacks

Register callbacks to verify widget updates:

```typescript
await comfyPage.page.evaluate(() => {
  const widget = window['app'].graph.nodes[0].widgets[0]
  widget.callback = (value: number) => {
    window['widgetValue'] = value
  }
})

// Perform action that triggers widget
await widget.dragHorizontal(50)

// Verify callback was called
expect(await comfyPage.page.evaluate(() => window['widgetValue'])).toBeDefined()
```

## Graph State Verification

```typescript
// Check node count
expect(await comfyPage.getGraphNodesCount()).toBe(5)

// Check selected count
expect(await comfyPage.getSelectedGraphNodesCount()).toBe(2)

// Check workflow modified status
expect(await comfyPage.isCurrentWorkflowModified()).toBe(false)
```

## Refreshing Combo Values

Testing the 'R' key refresh behavior:

```typescript
await comfyPage.loadWorkflow('inputs/optional_combo_input')

const getComboValues = async () =>
  comfyPage.page.evaluate(() => {
    return window['app'].graph.nodes
      .find((node) => node.title === 'My Node')
      .widgets.find((widget) => widget.name === 'combo_input').options.values
  })

const initialValues = await getComboValues()

// Focus canvas and press R to refresh
await comfyPage.page.mouse.click(400, 300)
await comfyPage.page.keyboard.press('r')
await comfyPage.page.waitForTimeout(500)

const refreshedValues = await getComboValues()
expect(refreshedValues).not.toEqual(initialValues)
```

## Example: Complete Execution Test

```typescript
import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Execution', { tag: ['@smoke', '@workflow'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test(
    'Report error on unconnected slot',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.disconnectEdge()
      await comfyPage.clickEmptySpace()

      await comfyPage.executeCommand('Comfy.QueuePrompt')
      await expect(comfyPage.page.locator('.comfy-error-report')).toBeVisible()

      await comfyPage.page.locator('.p-dialog-close-button').click()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'execution-error-unconnected-slot.png'
      )
    }
  )
})
```
