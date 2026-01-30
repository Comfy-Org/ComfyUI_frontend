import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { expect } from '@playwright/test'

test.describe(
  'Mobile Baseline Snapshots',
  { tag: ['@mobile', '@screenshot'] },
  () => {
    test('@mobile empty canvas', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.ConfirmClear', false)
      await comfyPage.executeCommand('Comfy.ClearWorkflow')
      await expect(async () => {
        expect(await comfyPage.getGraphNodesCount()).toBe(0)
      }).toPass({ timeout: 256 })
      await comfyPage.nextFrame()
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
      await comfyPage.nextFrame()

      await expect(comfyPage.settingDialog.root).toHaveScreenshot(
        'mobile-settings-dialog.png',
        {
          mask: [
            comfyPage.settingDialog.root.getByTestId('current-user-indicator')
          ]
        }
      )
    })
  }
)
