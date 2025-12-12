import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { expect } from '@playwright/test'

test.describe('Mobile Baseline Snapshots', () => {
  test('@mobile empty canvas', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => window.app.clean())
    await expect(comfyPage.canvas).toHaveScreenshot('mobile-empty-canvas.png')
  })

  test('@mobile default workflow', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')
    await expect(comfyPage.canvas).toHaveScreenshot(
      'mobile-default-workflow.png'
    )
  })

  test('@mobile settings dialog', async ({ comfyPage }) => {
    await comfyPage.settingDialog.open()
    await expect(comfyPage.page).toHaveScreenshot('mobile-settings-dialog.png')
  })
})
