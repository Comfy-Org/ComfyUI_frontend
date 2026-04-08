import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'
import {
  loadImageOnNode,
  openMaskEditorViaCommand
} from '../helpers/maskEditorTestUtils'

test.describe('Mask Editor', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  })

  test(
    'opens mask editor from image preview button',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const { imagePreview } = await loadImageOnNode(comfyPage)

      // Hover over the image panel to reveal action buttons
      await imagePreview.getByRole('region').hover()
      await comfyPage.page.getByLabel('Edit or mask image').click()

      const dialog = comfyPage.page.getByTestId(TestIds.maskEditor.dialog)
      await expect(dialog).toBeVisible()

      await expect(
        dialog.getByRole('heading', { name: 'Mask Editor' })
      ).toBeVisible()

      const canvasContainer = dialog.locator('#maskEditorCanvasContainer')
      await expect(canvasContainer).toBeVisible()
      await expect(canvasContainer.locator('canvas')).toHaveCount(4)

      await expect(
        dialog.getByTestId(TestIds.maskEditor.uiContainer)
      ).toBeVisible()
      await expect(dialog.getByText('Save')).toBeVisible()
      await expect(dialog.getByText('Cancel')).toBeVisible()

      await expect(dialog).toHaveScreenshot('mask-editor-dialog-open.png')
    }
  )

  test(
    'opens mask editor from context menu',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const { nodeId } = await loadImageOnNode(comfyPage)

      const nodeHeader = comfyPage.vueNodes
        .getNodeLocator(nodeId)
        .locator('.lg-node-header')
      await nodeHeader.click()
      await nodeHeader.click({ button: 'right' })

      const contextMenu = comfyPage.page.locator('.p-contextmenu')
      await expect(contextMenu).toBeVisible()

      await contextMenu.getByText('Open in Mask Editor').click()

      const dialog = comfyPage.page.getByTestId(TestIds.maskEditor.dialog)
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', { name: 'Mask Editor' })
      ).toBeVisible()

      await expect(dialog).toHaveScreenshot(
        'mask-editor-dialog-from-context-menu.png'
      )
    }
  )

  test(
    'opens mask editor via command execution',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const dialog = await openMaskEditorViaCommand(comfyPage)

      await expect(
        dialog.getByTestId(TestIds.maskEditor.uiContainer)
      ).toBeVisible()
      await expect(
        dialog.getByRole('heading', { name: 'Mask Editor' })
      ).toBeVisible()
      await expect(dialog).toHaveScreenshot('mask-editor-open-via-command.png')
    }
  )

  test(
    'cancel closes mask editor dialog without uploading',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const dialog = await openMaskEditorViaCommand(comfyPage)
      await expect(dialog).toBeVisible()

      const uploadRequests: string[] = []
      await comfyPage.page.route('**/upload/mask', (route) => {
        uploadRequests.push('mask')
        return route.continue()
      })
      await comfyPage.page.route('**/upload/image', (route) => {
        uploadRequests.push('image')
        return route.continue()
      })
      await expect(dialog).toHaveScreenshot('mask-editor-before-cancel.png')
      await dialog.getByRole('button', { name: /cancel/i }).click()

      await expect(dialog).not.toBeVisible()
      expect(uploadRequests).toHaveLength(0)
      await expect(comfyPage.canvas).toHaveScreenshot(
        'mask-editor-cancelled-canvas-state.png'
      )
    }
  )
})
