import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { expect } from '@playwright/test'

test.describe('Mobile Baseline Snapshots', () => {
  test('@mobile empty canvas', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.ConfirmClear', false)
    await comfyPage.executeCommand('Comfy.ClearWorkflow')
    await expect(async () => {
      expect(await comfyPage.getGraphNodesCount()).toBe(0)
    }).toPass({ timeout: 256 })
    await comfyPage.nextFrame()

    // Get viewport size and clip top 15%
    const viewportSize = comfyPage.page.viewportSize()
    const clipRegion = viewportSize
      ? {
          x: 0,
          y: Math.floor(viewportSize.height * 0.15),
          width: viewportSize.width,
          height: Math.ceil(viewportSize.height * 0.85)
        }
      : undefined

    await expect(comfyPage.canvas).toHaveScreenshot('mobile-empty-canvas.png', {
      clip: clipRegion
    })
  })

  test('@mobile default workflow', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')

    // Get viewport size and clip top 15%
    const viewportSize = comfyPage.page.viewportSize()
    const clipRegion = viewportSize
      ? {
          x: 0,
          y: Math.floor(viewportSize.height * 0.15),
          width: viewportSize.width,
          height: Math.ceil(viewportSize.height * 0.85)
        }
      : undefined

    await expect(comfyPage.canvas).toHaveScreenshot(
      'mobile-default-workflow.png',
      { clip: clipRegion }
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
})
