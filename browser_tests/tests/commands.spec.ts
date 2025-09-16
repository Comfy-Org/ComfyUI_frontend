import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Keybindings', () => {
  test('Should execute command', async ({ comfyPage }) => {
    await comfyPage.registerCommand('TestCommand', () => {
      ;(window as any)['foo'] = true
    })

    await comfyPage.executeCommand('TestCommand')
    expect(await comfyPage.page.evaluate(() => (window as any)['foo'])).toBe(
      true
    )
  })

  test('Should execute async command', async ({ comfyPage }) => {
    await comfyPage.registerCommand('TestCommand', async () => {
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          ;(window as any)['foo'] = true
          resolve()
        }, 5)
      )
    })

    await comfyPage.executeCommand('TestCommand')
    expect(await comfyPage.page.evaluate(() => (window as any)['foo'])).toBe(
      true
    )
  })

  test('Should handle command errors', async ({ comfyPage }) => {
    await comfyPage.registerCommand('TestCommand', () => {
      throw new Error('Test error')
    })

    await comfyPage.executeCommand('TestCommand')
    expect(await comfyPage.getToastErrorCount()).toBe(1)
  })

  test('Should handle async command errors', async ({ comfyPage }) => {
    await comfyPage.registerCommand('TestCommand', async () => {
      await new Promise<void>((_resolve, reject) =>
        setTimeout(() => {
          reject(new Error('Test error'))
        }, 5)
      )
    })

    await comfyPage.executeCommand('TestCommand')
    expect(await comfyPage.getToastErrorCount()).toBe(1)
  })
})
