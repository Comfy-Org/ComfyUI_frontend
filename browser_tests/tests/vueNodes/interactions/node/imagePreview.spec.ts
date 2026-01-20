import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'

test.describe('Vue Nodes Image Preview', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.loadWorkflow('widgets/load_image_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  async function loadImageOnNode(
    comfyPage: Awaited<
      ReturnType<(typeof test)['info']>
    >['fixtures']['comfyPage']
  ) {
    const loadImageNode = (await comfyPage.getNodeRefsByType('LoadImage'))[0]
    const { x, y } = await loadImageNode.getPosition()

    await comfyPage.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y }
    })

    const imagePreview = comfyPage.page.locator('.image-preview')
    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.locator('img')).toBeVisible()
    await expect(imagePreview).toContainText('x')

    return imagePreview
  }

  test('opens mask editor from image preview button', async ({ comfyPage }) => {
    const imagePreview = await loadImageOnNode(comfyPage)

    await imagePreview.locator('[role="img"]').hover()
    await comfyPage.page.getByLabel('Edit or mask image').click()

    await expect(comfyPage.page.locator('.mask-editor-dialog')).toBeVisible()
  })

  test('shows image context menu options', async ({ comfyPage }) => {
    await loadImageOnNode(comfyPage)

    const nodeHeader = comfyPage.vueNodes.getNodeByTitle('Load Image')
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
