# Fixtures Reference

## Core Fixtures

### comfyPage

The main page object with all helpers. Extends Playwright's Page.

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test('example', async ({ comfyPage }) => {
  // comfyPage is available
})
```

### comfyMouse

Mouse interaction helper for canvas operations.

```typescript
test('drag example', async ({ comfyPage, comfyMouse }) => {
  await comfyMouse.dragFromTo(start, end, { steps: 10 })
})
```

## comfyPage Methods

### Navigation & Workflow

| Method               | Description                |
| -------------------- | -------------------------- |
| `loadWorkflow(name)` | Load workflow from assets  |
| `getWorkflow()`      | Get current workflow state |
| `resetView()`        | Reset canvas view          |
| `reload()`           | Reload the page            |

### Canvas

| Method          | Description                |
| --------------- | -------------------------- |
| `canvas`        | The canvas locator         |
| `nextFrame()`   | Wait for next render frame |
| `pan({ x, y })` | Pan the canvas             |
| `zoom(factor)`  | Zoom the canvas            |

### Nodes

| Method                      | Description                               |
| --------------------------- | ----------------------------------------- |
| `getNodeRefsByTitle(title)` | Get nodes by display title (returns `[]`) |
| `getNodeRefById(id)`        | Get node by numeric ID                    |
| `getFirstNode()`            | Get first node                            |
| `getLastNode()`             | Get last node                             |
| `getNodes()`                | Get all nodes                             |
| `selectNodes(titles[])`     | Ctrl+click to select nodes by title       |

**Node titles**: Use display names like `'KSampler'`, `'VAE Decode'`, `'CLIP Text Encode (Prompt)'`.
These match the `display_name` from node definitions, not the internal type name.

### Settings

| Method                   | Description           |
| ------------------------ | --------------------- |
| `setSetting(key, value)` | Set a ComfyUI setting |
| `getSetting(key)`        | Get a setting value   |

### Files

| Method                                      | Description           |
| ------------------------------------------- | --------------------- |
| `dragAndDropFile(path, position, options?)` | Drag file onto canvas |

### Execution

| Method          | Description            |
| --------------- | ---------------------- |
| `queuePrompt()` | Queue current workflow |
| `interrupt()`   | Interrupt execution    |

## NodeReference Methods

Returned by `getNodeRefsByTitle()[0]`, `getNodeRefById()`.

| Method                | Description                 |
| --------------------- | --------------------------- |
| `click()`             | Click the node              |
| `drag({ x, y })`      | Drag node by offset         |
| `collapse()`          | Collapse node               |
| `expand()`            | Expand node                 |
| `bypass()`            | Bypass node                 |
| `pin()`               | Pin node                    |
| `getWidget(name)`     | Get widget by name          |
| `getInputSlot(name)`  | Get input slot              |
| `getOutputSlot(name)` | Get output slot             |
| `locator`             | Playwright Locator for node |

## SlotReference Methods

Returned by `getInputSlot()`, `getOutputSlot()`.

| Method          | Description                  |
| --------------- | ---------------------------- |
| `getPosition()` | Get slot position `{ x, y }` |
| `click()`       | Click the slot               |

## WidgetReference Methods

Returned by `getWidget()`.

| Method            | Description        |
| ----------------- | ------------------ |
| `setValue(value)` | Set widget value   |
| `getValue()`      | Get current value  |
| `click()`         | Click widget       |
| `locator`         | Playwright Locator |

## comfyMouse Methods

| Method                             | Description            |
| ---------------------------------- | ---------------------- |
| `dragFromTo(start, end, options?)` | Drag from start to end |
| `move(position)`                   | Move mouse to position |
| `click(position)`                  | Click at position      |

### dragFromTo Options

```typescript
{
  steps?: number,    // Number of intermediate steps (default: 1)
  button?: 'left' | 'right' | 'middle'
}
```

## Custom Assertions (comfyExpect)

```typescript
import { comfyExpect as expect } from './fixtures/ComfyPage'

// Node state assertions
await expect(node).toBeCollapsed()
await expect(node).toBeBypassed()
await expect(node).toBePinned()

// Negation
await expect(node).not.toBeCollapsed()
```

## Component Fixtures

Located in `fixtures/components/`:

### Topbar

```typescript
const topbar = comfyPage.topbar
await topbar.clickMenu('File')
await topbar.clickMenuItem('Save')
```

### SidebarTab

```typescript
const sidebar = comfyPage.sidebar
await sidebar.open('nodes')
await sidebar.search('KSampler')
```

### SearchBox

```typescript
await comfyPage.searchBox.open()
await comfyPage.searchBox.search('Load Checkpoint')
await comfyPage.searchBox.selectFirst()
```

## Source Files

| Fixture       | File                                              |
| ------------- | ------------------------------------------------- |
| ComfyPage     | `browser_tests/fixtures/ComfyPage.ts`             |
| ComfyMouse    | `browser_tests/fixtures/ComfyMouse.ts`            |
| NodeReference | `browser_tests/fixtures/NodeReference.ts`         |
| Topbar        | `browser_tests/fixtures/components/Topbar.ts`     |
| SidebarTab    | `browser_tests/fixtures/components/SidebarTab.ts` |
| utils         | `browser_tests/fixtures/utils.ts`                 |
