import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Mask Editor', { tag: '@vue-nodes' }, () => {
  async function loadImageOnNode(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const loadImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    )[0]
    const { x, y } = await loadImageNode.getPosition()

    await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y }
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

  async function openMaskEditorDialog(comfyPage: ComfyPage) {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    await imagePreview.getByRole('region').hover()
    await comfyPage.page.getByLabel('Edit or mask image').click()

    const dialog = comfyPage.page.locator('.mask-editor-dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('heading', { name: 'Mask Editor' })
    ).toBeVisible()

    const canvasContainer = dialog.locator('#maskEditorCanvasContainer')
    await expect(canvasContainer).toBeVisible()
    await expect(canvasContainer.locator('canvas')).toHaveCount(4)

    return dialog
  }

  async function getMaskCanvasPixelData(page: Page) {
    return page.evaluate(() => {
      const canvases = document.querySelectorAll(
        '#maskEditorCanvasContainer canvas'
      )
      // The mask canvas is the 3rd canvas (index 2, z-30)
      const maskCanvas = canvases[2] as HTMLCanvasElement
      if (!maskCanvas) return null
      const ctx = maskCanvas.getContext('2d')
      if (!ctx) return null
      const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
      let nonTransparentPixels = 0
      for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] > 0) nonTransparentPixels++
      }
      return { nonTransparentPixels, totalPixels: data.data.length / 4 }
    })
  }

  function pollMaskPixelCount(page: Page): Promise<number> {
    return getMaskCanvasPixelData(page).then(
      (d) => d?.nonTransparentPixels ?? 0
    )
  }

  async function drawStrokeOnPointerZone(
    page: Page,
    dialog: ReturnType<typeof page.locator>
  ) {
    const pointerZone = dialog.locator(
      '.maskEditor-ui-container [class*="w-[calc"]'
    )
    await expect(pointerZone).toBeVisible()

    const box = await pointerZone.boundingBox()
    if (!box) throw new Error('Pointer zone bounding box not found')

    const startX = box.x + box.width * 0.3
    const startY = box.y + box.height * 0.5
    const endX = box.x + box.width * 0.7
    const endY = box.y + box.height * 0.5

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()

    return { startX, startY, endX, endY, box }
  }

  async function drawStrokeAndExpectPixels(
    comfyPage: ComfyPage,
    dialog: ReturnType<typeof comfyPage.page.locator>
  ) {
    await drawStrokeOnPointerZone(comfyPage.page, dialog)
    await expect
      .poll(() => pollMaskPixelCount(comfyPage.page))
      .toBeGreaterThan(0)
  }

  test(
    'opens mask editor from image preview button',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const { imagePreview } = await loadImageOnNode(comfyPage)

      // Hover over the image panel to reveal action buttons
      await imagePreview.getByRole('region').hover()
      await comfyPage.page.getByLabel('Edit or mask image').click()

      const dialog = comfyPage.page.locator('.mask-editor-dialog')
      await expect(dialog).toBeVisible()

      await expect(
        dialog.getByRole('heading', { name: 'Mask Editor' })
      ).toBeVisible()

      const canvasContainer = dialog.locator('#maskEditorCanvasContainer')
      await expect(canvasContainer).toBeVisible()
      await expect(canvasContainer.locator('canvas')).toHaveCount(4)

      await expect(dialog.locator('.maskEditor-ui-container')).toBeVisible()
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

      const dialog = comfyPage.page.locator('.mask-editor-dialog')
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', { name: 'Mask Editor' })
      ).toBeVisible()

      await expect(dialog).toHaveScreenshot(
        'mask-editor-dialog-from-context-menu.png'
      )
    }
  )

  test('draws a brush stroke on the mask canvas', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    const dataBefore = await getMaskCanvasPixelData(comfyPage.page)
    expect(dataBefore).not.toBeNull()
    expect(dataBefore!.nonTransparentPixels).toBe(0)

    await drawStrokeAndExpectPixels(comfyPage, dialog)
  })

  test('undo reverts a brush stroke', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    const undoButton = dialog.locator('button[title="Undo"]')
    await expect(undoButton).toBeVisible()
    await undoButton.click()

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)
  })

  test('redo restores an undone stroke', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    const undoButton = dialog.locator('button[title="Undo"]')
    await undoButton.click()

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)

    const redoButton = dialog.locator('button[title="Redo"]')
    await expect(redoButton).toBeVisible()
    await redoButton.click()

    await expect
      .poll(() => pollMaskPixelCount(comfyPage.page))
      .toBeGreaterThan(0)
  })

  test('clear button removes all mask content', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    const clearButton = dialog.getByRole('button', { name: 'Clear' })
    await expect(clearButton).toBeVisible()
    await clearButton.click()

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)
  })

  test('cancel closes the dialog without saving', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    const cancelButton = dialog.getByRole('button', { name: 'Cancel' })
    await cancelButton.click()

    await expect(dialog).toBeHidden()
  })

  test('invert button inverts the mask', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    const dataBefore = await getMaskCanvasPixelData(comfyPage.page)
    expect(dataBefore).not.toBeNull()
    const pixelsBefore = dataBefore!.nonTransparentPixels

    const invertButton = dialog.getByRole('button', { name: 'Invert' })
    await expect(invertButton).toBeVisible()
    await invertButton.click()

    await expect
      .poll(() => pollMaskPixelCount(comfyPage.page))
      .toBeGreaterThan(pixelsBefore)
  })

  test('keyboard shortcut Ctrl+Z triggers undo', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    const modifier = process.platform === 'darwin' ? 'Meta+z' : 'Control+z'
    await comfyPage.page.keyboard.press(modifier)

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)
  })

  test(
    'tool panel shows all five tools',
    { tag: ['@smoke'] },
    async ({ comfyPage }) => {
      const dialog = await openMaskEditorDialog(comfyPage)

      const toolPanel = dialog.locator('.maskEditor-ui-container')
      await expect(toolPanel).toBeVisible()

      // The tool panel should contain exactly 5 tool entries
      const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
      await expect(toolEntries).toHaveCount(5)

      // First tool (MaskPen) should be selected by default
      const selectedTool = dialog.locator(
        '.maskEditor_toolPanelContainerSelected'
      )
      await expect(selectedTool).toHaveCount(1)
    }
  )

  test('switching tools updates the selected indicator', async ({
    comfyPage
  }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
    await expect(toolEntries).toHaveCount(5)

    // Click the third tool (Eraser, index 2)
    await toolEntries.nth(2).click()

    // The third tool should now be selected
    const selectedTool = dialog.locator(
      '.maskEditor_toolPanelContainerSelected'
    )
    await expect(selectedTool).toHaveCount(1)

    // Verify it's the eraser (3rd entry)
    await expect(toolEntries.nth(2)).toHaveClass(/Selected/)
  })

  test('brush settings panel is visible with thickness controls', async ({
    comfyPage
  }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    // The side panel should show brush settings by default
    const thicknessLabel = dialog.getByText('Thickness')
    await expect(thicknessLabel).toBeVisible()

    const opacityLabel = dialog.getByText('Opacity').first()
    await expect(opacityLabel).toBeVisible()

    const hardnessLabel = dialog.getByText('Hardness')
    await expect(hardnessLabel).toBeVisible()
  })

  test('save uploads all layers and closes dialog', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    let maskUploadCount = 0
    let imageUploadCount = 0

    await comfyPage.page.route('**/upload/mask', (route) => {
      maskUploadCount++
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: `test-mask-${maskUploadCount}.png`,
          subfolder: 'clipspace',
          type: 'input'
        })
      })
    })
    await comfyPage.page.route('**/upload/image', (route) => {
      imageUploadCount++
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: `test-image-${imageUploadCount}.png`,
          subfolder: 'clipspace',
          type: 'input'
        })
      })
    })

    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeVisible()
    await saveButton.click()

    await expect(dialog).toBeHidden()

    // The save pipeline uploads multiple layers (mask + image variants)
    expect(
      maskUploadCount + imageUploadCount,
      'save should trigger upload calls'
    ).toBeGreaterThan(0)
  })

  test('save failure keeps dialog open', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    // Fail all upload routes
    await comfyPage.page.route('**/upload/mask', (route) =>
      route.fulfill({ status: 500 })
    )
    await comfyPage.page.route('**/upload/image', (route) =>
      route.fulfill({ status: 500 })
    )

    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await saveButton.click()

    // Dialog should remain open when save fails
    await expect(dialog).toBeVisible()
  })

  test(
    'eraser tool removes mask content',
    { tag: ['@screenshot'] },
    async ({ comfyPage }) => {
      const dialog = await openMaskEditorDialog(comfyPage)

      // Draw a stroke with the mask pen (default tool)
      await drawStrokeAndExpectPixels(comfyPage, dialog)

      const pixelsAfterDraw = await getMaskCanvasPixelData(comfyPage.page)

      // Switch to eraser tool (3rd tool, index 2)
      const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
      await toolEntries.nth(2).click()

      // Draw over the same area with the eraser
      await drawStrokeOnPointerZone(comfyPage.page, dialog)

      await expect
        .poll(() => pollMaskPixelCount(comfyPage.page))
        .toBeLessThan(pixelsAfterDraw!.nonTransparentPixels)
    }
  )
})
