import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Browser tab title', () => {
  test.describe('Beta Menu', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Can display workflow name', async ({ comfyPage }) => {
      const workflowName = await comfyPage.page.evaluate(async () => {
        const app = window['app']
        if (!app) throw new Error('App not initialized')
        const extMgr = app.extensionManager as {
          workflow?: { activeWorkflow?: { filename?: string } }
        }
        return extMgr.workflow?.activeWorkflow?.filename
      })
      expect(await comfyPage.page.title()).toBe(`*${workflowName} - ComfyUI`)
    })

    // Failing on CI
    // Cannot reproduce locally
    test.skip('Can display workflow name with unsaved changes', async ({
      comfyPage
    }) => {
      const workflowName = await comfyPage.page.evaluate(async () => {
        const app = window['app']
        if (!app) throw new Error('App not initialized')
        const extMgr = app.extensionManager as {
          workflow?: { activeWorkflow?: { filename?: string } }
        }
        return extMgr.workflow?.activeWorkflow?.filename
      })
      expect(await comfyPage.page.title()).toBe(`${workflowName} - ComfyUI`)

      await comfyPage.menu.topbar.saveWorkflow('test')
      expect(await comfyPage.page.title()).toBe('test - ComfyUI')

      const textBox = comfyPage.widgetTextBox
      await textBox.fill('Hello World')
      await comfyPage.clickEmptySpace()
      expect(await comfyPage.page.title()).toBe(`*test - ComfyUI`)

      // Delete the saved workflow for cleanup.
      await comfyPage.page.evaluate(async () => {
        const app = window['app']
        if (!app) throw new Error('App not initialized')
        const extMgr = app.extensionManager as {
          workflow?: { activeWorkflow?: { delete?: () => Promise<void> } }
        }
        return extMgr.workflow?.activeWorkflow?.delete?.()
      })
    })
  })

  test.describe('Legacy Menu', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Can display default title', async ({ comfyPage }) => {
      expect(await comfyPage.page.title()).toBe('ComfyUI')
    })
  })
})
