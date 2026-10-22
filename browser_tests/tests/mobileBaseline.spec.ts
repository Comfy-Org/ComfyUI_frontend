import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe(
  'Mobile Baseline Snapshots',
  { tag: ['@mobile', '@screenshot'] },
  () => {
    test('@mobile empty canvas', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.ConfirmClear', false)
      await comfyPage.command.executeCommand('Comfy.ClearWorkflow')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      await expectElementScreenshot(comfyPage.canvas, 'mobile-empty-canvas.png')
    })

    test('@mobile default workflow', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await expectElementScreenshot(
        comfyPage.canvas,
        'mobile-default-workflow.png'
      )
    })

    test('@mobile graph canvas toolbar visible', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)

      const minimapButton = comfyPage.page.getByTestId(
        TestIds.canvas.toggleMinimapButton
      )
      await expect(minimapButton).toBeVisible()

      await expectElementScreenshot(
        comfyPage.canvas,
        'mobile-graph-canvas-toolbar.png'
      )
    })

    test('@mobile settings dialog', async ({ comfyPage }) => {
      await comfyPage.settingDialog.open()
      await expectElementScreenshot(
        comfyPage.settingDialog.root,
        'mobile-settings-dialog.png',
        {
          mask: [
            comfyPage.settingDialog.root.getByTestId(
              TestIds.user.currentUserIndicator
            )
          ]
        }
      )
    })
  }
)
