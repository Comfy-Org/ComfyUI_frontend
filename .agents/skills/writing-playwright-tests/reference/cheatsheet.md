# Playwright Test Cheatsheet

Quick reference for common operations. See linked files for details.

## Imports

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'
```

## Test Structure

```typescript
test.describe('Feature', { tag: ['@screenshot', '@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.resetView()
  })

  test('does something', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('myWorkflow')
    await comfyPage.nextFrame()
    // test logic
  })
})
```

## Workflows

| Operation        | Code                                                          |
| ---------------- | ------------------------------------------------------------- |
| Load from assets | `await comfyPage.loadWorkflow('widgets/slider')`              |
| Load default     | `await comfyPage.executeCommand('Comfy.LoadDefaultWorkflow')` |
| Reset view       | `await comfyPage.resetView()`                                 |

## Canvas

| Operation    | Code                                                        |
| ------------ | ----------------------------------------------------------- |
| Click        | `await comfyPage.canvas.click({ position: { x, y } })`      |
| Double-click | `await comfyPage.page.mouse.dblclick(x, y, { delay: 5 })`   |
| Pan          | `await comfyPage.pan({ x: 100, y: 100 })`                   |
| Zoom         | `await comfyPage.zoom(-100)` / `zoom(100)`                  |
| Next frame   | `await comfyPage.nextFrame()` ← **Always after canvas ops** |
| Focus        | `await comfyPage.canvas.click()` ← **Before keyboard**      |

## Keyboard Shortcuts

```typescript
await comfyPage.canvas.click() // Focus first!
await comfyPage.canvas.press('Control+a')
await comfyPage.canvas.press('Delete')
```

| Shortcut   | Helper                    |
| ---------- | ------------------------- |
| Select all | `await comfyPage.ctrlA()` |
| Copy       | `await comfyPage.ctrlC()` |
| Paste      | `await comfyPage.ctrlV()` |
| Undo       | `await comfyPage.ctrlZ()` |
| Redo       | `await comfyPage.ctrlY()` |
| Bypass     | `await comfyPage.ctrlB()` |

## Nodes

| Operation    | Code                                                 |
| ------------ | ---------------------------------------------------- |
| By type      | `(await comfyPage.getNodeRefsByType('KSampler'))[0]` |
| By title     | `(await comfyPage.getNodeRefsByTitle('My Node'))[0]` |
| By ID        | `await comfyPage.getNodeRefById(3)`                  |
| First node   | `await comfyPage.getFirstNodeRef()`                  |
| Click title  | `await node.click('title')`                          |
| Right-click  | `await node.click('title', { button: 'right' })`     |
| Collapse     | `await node.click('collapse')`                       |
| Get position | `await node.getPosition()`                           |
| Get size     | `await node.getSize()`                               |
| Context menu | `await node.clickContextMenuOption('Colors')`        |

## Widgets

```typescript
const widget = await node.getWidget(0) // by index
await widget.click()
await widget.dragHorizontal(50) // for sliders
const value = await widget.getValue()
```

## Connections

```typescript
await node1.connectOutput(0, node2, 0) // output slot to input slot
await node1.connectWidget(0, node2, 0) // output to widget
await comfyPage.disconnectEdge()
await comfyPage.connectEdge()
```

## Settings

```typescript
await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
await comfyPage.setSetting('Comfy.EnableTooltips', false)
const val = await comfyPage.getSetting('Comfy.UseNewMenu')
```

## Search Box

```typescript
await comfyPage.doubleClickCanvas() // opens search box
await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')
await comfyPage.searchBox.addFilter('MODEL', 'Input Type')
```

## Sidebar

```typescript
// Workflows tab
const tab = comfyPage.menu.workflowsTab
await tab.open()
await tab.switchToWorkflow('workflow1')
const names = await tab.getOpenedWorkflowNames()

// Node library
const lib = comfyPage.menu.nodeLibraryTab
await lib.open()
await lib.nodeLibrarySearchBoxInput.fill('KSampler')

// Topbar
await comfyPage.menu.topbar.saveWorkflow('file.json')
```

## Dialogs

```typescript
// Confirm dialog
await comfyPage.confirmDialog.confirm()
await comfyPage.confirmDialog.cancel()

// Settings dialog
await comfyPage.settingDialog.open()
await comfyPage.settingDialog.close()

// LiteGraph prompt dialog
await comfyPage.page.waitForSelector('.graphdialog input', { state: 'visible' })
await comfyPage.page.fill('.graphdialog input', 'value')
await comfyPage.page.keyboard.press('Enter')
```

## Assertions

```typescript
// Standard Playwright
await expect(element).toBeVisible()
await expect(page).toHaveURL('/path')

// Custom ComfyUI matchers
await expect(node).toBeCollapsed()
await expect(node).toBeBypassed()
await expect(node).toBePinned()

// Screenshots
await expect(comfyPage.canvas).toHaveScreenshot('name.png')
```

## Mocking

```typescript
// API route
await comfyPage.page.route('**/api/queue', (route) =>
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: 'mocked' })
  })
)

// Block resources
await context.route('**/*.{png,jpg}', (route) => route.abort())
```

## File Drag-and-Drop

```typescript
await comfyPage.dragAndDropFile('browser_tests/assets/images/test.png', {
  x: 100,
  y: 100
})
```

## Subgraphs

```typescript
await subgraphNode.navigateIntoSubgraph()
await comfyPage.page.keyboard.press('Escape') // exit
await comfyPage.connectFromSubgraphInput(node, 0)
await comfyPage.connectToSubgraphOutput(node, 0)
```

## Page Evaluation

```typescript
// Run code in browser context
await comfyPage.page.evaluate(() => {
  window['app'].graph.setDirtyCanvas(true, true)
})

// Wait for condition
await comfyPage.page.waitForFunction(
  () => window['app']?.extensionManager?.workflow?.isBusy === false
)
```

## Tags Quick Reference

| Tag           | Purpose              | Run with                  |
| ------------- | -------------------- | ------------------------- |
| `@smoke`      | Fast essential tests | `--grep @smoke`           |
| `@slow`       | Long-running tests   | `--grep-invert @slow`     |
| `@screenshot` | Visual regression    | `--grep @screenshot`      |
| `@mobile`     | Mobile viewport      | `--project=mobile-chrome` |
| `@2x`         | HiDPI scale          | `--project=chromium-2x`   |
| `@canvas`     | Canvas tests         | `--grep @canvas`          |
| `@node`       | Node tests           | `--grep @node`            |
| `@widget`     | Widget tests         | `--grep @widget`          |

## Run Commands

```bash
pnpm exec playwright test --ui                    # UI mode (recommended)
pnpm test:browser:local                           # Local with traces
pnpm exec playwright test --grep @smoke           # By tag
pnpm exec playwright test --grep-invert @screenshot  # Skip screenshots
pnpm exec playwright test mytest.spec.ts:25       # Specific line
pnpm exec playwright test --debug                 # Debug mode
```
