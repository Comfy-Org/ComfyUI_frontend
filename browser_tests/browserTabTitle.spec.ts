import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Browser tab title', () => {
  test.describe('Beta Menu', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Can display workflow name', async ({ comfyPage }) => {
      const workflowName = await comfyPage.page.evaluate(async () => {
        return window['app'].workflowManager.activeWorkflow.name
      })
      expect(await comfyPage.page.title()).toBe(workflowName)
    })

    test('Can display workflow name with unsaved changes', async ({
      comfyPage
    }) => {
      const workflowName = await comfyPage.page.evaluate(async () => {
        return window['app'].workflowManager.activeWorkflow.name
      })
      expect(await comfyPage.page.title()).toBe(workflowName)

      const textBox = comfyPage.widgetTextBox
      await textBox.fill('Hello World')

      expect(await comfyPage.page.title()).toBe(`*${workflowName}`)
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
