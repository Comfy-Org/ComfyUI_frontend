# Command Store Patterns

The command store allows executing and registering commands programmatically.

## Executing Commands

```typescript
// Execute a built-in command
await comfyPage.executeCommand('Comfy.QueuePrompt')
await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
await comfyPage.executeCommand('Comfy.BrowseTemplates')
await comfyPage.executeCommand('Comfy.QueueSelectedOutputNodes')
```

## Common Built-in Commands

| Command ID                       | Description                        |
| -------------------------------- | ---------------------------------- |
| `Comfy.QueuePrompt`              | Queue workflow for execution       |
| `Comfy.NewBlankWorkflow`         | Clear canvas with new workflow     |
| `Comfy.BrowseTemplates`          | Open templates dialog              |
| `Comfy.QueueSelectedOutputNodes` | Execute only selected output nodes |

## Registering Custom Commands

For testing command behavior:

```typescript
// Register a sync command
await comfyPage.registerCommand('TestCommand', () => {
  window['foo'] = true
})
await comfyPage.executeCommand('TestCommand')
expect(await comfyPage.page.evaluate(() => window['foo'])).toBe(true)

// Register an async command
await comfyPage.registerCommand('AsyncTestCommand', async () => {
  await new Promise<void>((resolve) =>
    setTimeout(() => {
      window['bar'] = true
      resolve()
    }, 5)
  )
})
```

## Testing Command Errors

```typescript
await comfyPage.registerCommand('ErrorCommand', () => {
  throw new Error('Test error')
})

await comfyPage.executeCommand('ErrorCommand')
expect(await comfyPage.getToastErrorCount()).toBe(1)
```

## Registering Keybindings

```typescript
await comfyPage.registerKeybinding({ key: 'KeyT', ctrl: true }, () => {
  window['keybindingTriggered'] = true
})

await comfyPage.page.keyboard.press('Control+t')
```

## How It Works

Commands are registered via the extension system:

```typescript
// Under the hood, registerCommand does this:
app.registerExtension({
  name: 'TestExtension_abc123',
  commands: [
    {
      id: 'TestCommand',
      function: () => {
        /* your function */
      }
    }
  ]
})
```

## Example: Command Test

```typescript
import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Commands', { tag: '@keyboard' }, () => {
  test('Should execute command', async ({ comfyPage }) => {
    await comfyPage.registerCommand('TestCommand', () => {
      window['foo'] = true
    })

    await comfyPage.executeCommand('TestCommand')
    expect(await comfyPage.page.evaluate(() => window['foo'])).toBe(true)
  })

  test('Should handle command errors', async ({ comfyPage }) => {
    await comfyPage.registerCommand('TestCommand', () => {
      throw new Error('Test error')
    })

    await comfyPage.executeCommand('TestCommand')
    expect(await comfyPage.getToastErrorCount()).toBe(1)
  })
})
```
