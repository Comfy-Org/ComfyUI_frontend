import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Vue Nodes Mask Editor', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setSetting('Comfy.Canvas.SelectionToolbox', true)
  })

  test('opens mask editor from toolbox and image overlay buttons', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('widgets/load_image_widget')
    await comfyPage.vueNodes.waitForNodes()

    // Get the LoadImage node and drop an image onto it
    const nodes = await comfyPage.getNodeRefsByType('LoadImage')
    const loadImageNode = nodes[0]
    const { x, y } = await loadImageNode.getPosition()

    await comfyPage.dragAndDropFile('image32x32.webp', {
      dropPosition: { x: x + 100, y: y + 100 },
      waitForUpload: true
    })

    // Wait for image preview to appear
    const imagePreview = comfyPage.page.locator('.image-preview img')
    await expect(imagePreview).toBeVisible()

    const maskEditorDialog = comfyPage.page.locator('.maskEditor-dialog-root')

    // Test 1: Open from toolbox button
    await comfyPage.selectNodes(['Load Image'])
    await expect(comfyPage.selectionToolbox).toBeVisible()

    const toolboxMaskButton = comfyPage.selectionToolbox.getByRole('button', {
      name: /mask editor/i
    })
    await expect(toolboxMaskButton).toBeVisible()
    await toolboxMaskButton.click()

    await expect(maskEditorDialog).toBeVisible()

    // Close mask editor
    await comfyPage.page.keyboard.press('Escape')
    await expect(maskEditorDialog).not.toBeVisible()

    // Test 2: Open from image overlay button
    const imageWrapper = comfyPage.page.locator('.image-preview [role="img"]')
    await imageWrapper.hover()

    const overlayMaskButton = comfyPage.page.locator(
      '.image-preview [aria-label="Edit or mask image"]'
    )
    await expect(overlayMaskButton).toBeVisible()
    await overlayMaskButton.click()

    await expect(maskEditorDialog).toBeVisible()
  })
})
