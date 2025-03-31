import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Execution', () => {
  test('Report error on unconnected slot', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge()
    await comfyPage.clickEmptySpace()

    await comfyPage.executeCommand('Comfy.QueuePrompt')
    await expect(comfyPage.page.locator('.comfy-error-report')).toBeVisible()
    await comfyPage.page.locator('.p-dialog-close-button').click()
    await comfyPage.page.locator('.comfy-error-report').waitFor({
      state: 'hidden'
    })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'execution-error-unconnected-slot.png'
    )
  })
})
