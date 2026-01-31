# Advanced Patterns

## Change Transactions (Grouped Undo)

Group multiple changes for single undo:

```typescript
await comfyPage.page.evaluate(() => {
  window['app'].canvas.emitBeforeChange()
})

// ... make multiple changes ...

await comfyPage.page.evaluate(() => {
  window['app'].canvas.emitAfterChange()
})
```

## Mark Canvas Dirty

After programmatic changes to the graph:

```typescript
await comfyPage.page.evaluate(() => {
  window['app'].graph.nodes[0].addWidget('number', 'new_widget', 10)
  window['app'].graph.setDirtyCanvas(true, true) // Required!
})
await comfyPage.nextFrame()
```

## Wait for Workflow Service

After file operations, wait for workflow service to settle:

```typescript
await comfyPage.page.waitForFunction(
  () => window['app']?.extensionManager?.workflow?.isBusy === false,
  undefined,
  { timeout: 3000 }
)
```

## Dialog Mask Handling

Wait for dialog masks to disappear:

```typescript
const mask = comfyPage.page.locator('.p-dialog-mask')
if ((await mask.count()) > 0) {
  await mask.first().waitFor({ state: 'hidden', timeout: 3000 })
}
```

## LiteGraph Context Menu

Click items in LiteGraph context menus:

```typescript
await node.click('title', { button: 'right' })
await comfyPage.clickLitegraphContextMenuItem('Remove Slot')
```

## LiteGraph Prompt Dialog

Handle LiteGraph's prompt dialogs:

```typescript
await comfyPage.page.waitForSelector('.graphdialog input', { state: 'visible' })
await comfyPage.page.fill('.graphdialog input', 'new_name')
await comfyPage.page.keyboard.press('Enter')
```

## Move Mouse Away for Clean Screenshots

Avoid hover effects in screenshots:

```typescript
await node.click('title')
await comfyPage.moveMouseToEmptyArea()
await expect(comfyPage.canvas).toHaveScreenshot('clean.png')
```

## Setup Workflows Directory

Set up/clear workflows for a test:

```typescript
test.afterEach(async ({ comfyPage }) => {
  await comfyPage.setupWorkflowsDirectory({}) // Clear all
})

// Or set up specific workflows
await comfyPage.setupWorkflowsDirectory({
  'workflow1.json': workflowData1,
  'workflow2.json': workflowData2
})
```

## Execute Commands

Run ComfyUI commands:

```typescript
await comfyPage.executeCommand('Comfy.LoadDefaultWorkflow')
await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
await comfyPage.executeCommand('Comfy.ClearWorkflow')
```

## Access App Instance

Direct access to the app instance:

```typescript
const result = await comfyPage.page.evaluate(() => {
  return window['app'].graph.nodes.length
})
```

## WebSocket Mocking

See [mocking.md](mocking.md#websocket-mocking) for WebSocket patterns.

## Vue Node Testing

Test Vue-rendered nodes:

```typescript
const vueNode = comfyPage.vueNodes.getByTitle('My Vue Node')
await vueNode.waitForRender()
const content = await vueNode.getContent()
```

## Test with Ctrl Modifier

Click with modifier keys:

```typescript
await node.click('title', { modifiers: ['Control'] })
await node.click('title', { modifiers: ['Shift'] })
await node.click('title', { modifiers: ['Control', 'Shift'] })
```

## Parallel Test Isolation

Each test gets unique user ID for isolation:

```typescript
test('isolated test', async ({ comfyPage }) => {
  // comfyPage.id is unique per test instance
  const uniqueWorkflow = `workflow-${comfyPage.id}.json`
})
```

## Platform-Specific Tests

Skip tests based on platform:

```typescript
test('linux only', async ({ comfyPage }) => {
  test.skip(process.platform !== 'linux', 'Linux only test')
  // ...
})
```

## Wait for Animation

Wait for CSS animations to complete:

```typescript
await comfyPage.page.waitForFunction(() => {
  const el = document.querySelector('.animated-element')
  return (
    getComputedStyle(el).animationPlayState === 'paused' ||
    getComputedStyle(el).animationName === 'none'
  )
})
```

## Capture Network Response

Wait for and capture specific network responses:

```typescript
const responsePromise = comfyPage.page.waitForResponse('**/api/history')
await comfyPage.page.click('[data-testid="history-btn"]')
const response = await responsePromise
const data = await response.json()
```

## Retry Flaky Operations

Use `toPass` for inherently flaky assertions:

```typescript
await expect(async () => {
  const value = await widget.getValue()
  expect(value).toBe(100)
}).toPass({ timeout: 2000, intervals: [100, 200, 500] })
```

## Screenshot with Masking

Mask dynamic content in screenshots:

```typescript
await expect(comfyPage.canvas).toHaveScreenshot('page.png', {
  mask: [
    comfyPage.page.locator('.timestamp'),
    comfyPage.page.locator('.random-id')
  ]
})
```
