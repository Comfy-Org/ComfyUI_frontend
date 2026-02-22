import { expect } from '@playwright/test'

import type { ComfyPage } from '../../../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'

test.describe('Vue Nodes Image Preview', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  async function loadImageOnNode(comfyPage: ComfyPage) {
    const loadImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    ).at(0)
    if (!loadImageNode) {
      throw new Error('LoadImage node not found')
    }
    const { x, y } = await loadImageNode.getTitlePosition()

    await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y },
      waitForUpload: true
    })

    const imagePreview = comfyPage.page.locator('.image-preview')
    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.locator('img')).toBeVisible()
    await expect(imagePreview).toContainText('x')

    return {
      imagePreview,
      nodeId: String(loadImageNode.id)
    }
  }

  test('opens mask editor from image preview button', async ({ comfyPage }) => {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    await imagePreview.locator('[role="img"]').focus()
    await comfyPage.page.getByLabel('Edit or mask image').click()

    await expect(comfyPage.page.locator('.mask-editor-dialog')).toBeVisible()
  })

  test('shows image context menu options', async ({ comfyPage }) => {
    const { nodeId } = await loadImageOnNode(comfyPage)

    const nodeHeader = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-header')
    await nodeHeader.click()
    await nodeHeader.click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible()
    await expect(contextMenu.getByText('Open Image')).toBeVisible()
    await expect(contextMenu.getByText('Copy Image')).toBeVisible()
    await expect(contextMenu.getByText('Save Image')).toBeVisible()
    await expect(contextMenu.getByText('Open in Mask Editor')).toBeVisible()
  })
})
