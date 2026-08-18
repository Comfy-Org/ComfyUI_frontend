import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Textarea widget font size',
  { tag: ['@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
    })

    test('applies Comfy.TextareaWidget.FontSize to Vue Nodes 2.0 textarea widget', async ({
      comfyPage
    }) => {
      const textarea = comfyPage.vueNodes.nodes.locator('textarea').first()
      await expect(textarea).toBeVisible()

      await comfyPage.settings.setSetting('Comfy.TextareaWidget.FontSize', 14)
      await expect
        .poll(() => textarea.evaluate((el) => getComputedStyle(el).fontSize))
        .toBe('14px')

      await comfyPage.settings.setSetting('Comfy.TextareaWidget.FontSize', 22)
      await expect
        .poll(() => textarea.evaluate((el) => getComputedStyle(el).fontSize))
        .toBe('22px')
    })
  }
)
