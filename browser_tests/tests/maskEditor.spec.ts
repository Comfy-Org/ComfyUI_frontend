import { expect } from '@playwright/test'

import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'

test.describe('Mask Editor', { tag: '@vue-nodes' }, () => {
  test(
    'opens mask editor from image preview button',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage, maskEditor }) => {
      const { imagePreview } = await maskEditor.loadImageOnNode()

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

      await comfyPage.expectScreenshot(dialog, 'mask-editor-dialog-open.png')
    }
  )

  test(
    'opens mask editor from context menu',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage, maskEditor }) => {
      const { nodeId } = await maskEditor.loadImageOnNode()

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

      await comfyPage.expectScreenshot(
        dialog,
        'mask-editor-dialog-from-context-menu.png'
      )
    }
  )

  test('draws a brush stroke on the mask canvas', async ({ maskEditor }) => {
    const dialog = await maskEditor.openDialog()

    const dataBefore = await maskEditor.getCanvasPixelData(2)
    expect(dataBefore).not.toBeNull()
    expect(dataBefore!.nonTransparentPixels).toBe(0)

    await maskEditor.drawStrokeAndExpectPixels(dialog)
  })

  test('undo reverts a brush stroke', async ({ maskEditor }) => {
    const dialog = await maskEditor.openDialog()

    await maskEditor.drawStrokeAndExpectPixels(dialog)

    const undoButton = dialog.locator('button[title="Undo"]')
    await expect(undoButton).toBeVisible()
    await undoButton.click()

    await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(0)
  })

  test('redo restores an undone stroke', async ({ maskEditor }) => {
    const dialog = await maskEditor.openDialog()

    await maskEditor.drawStrokeAndExpectPixels(dialog)

    const undoButton = dialog.locator('button[title="Undo"]')
    await undoButton.click()

    await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(0)

    const redoButton = dialog.locator('button[title="Redo"]')
    await expect(redoButton).toBeVisible()
    await redoButton.click()

    await expect.poll(() => maskEditor.pollMaskPixelCount()).toBeGreaterThan(0)
  })

  test('clear button removes all mask content', async ({ maskEditor }) => {
    const dialog = await maskEditor.openDialog()

    await maskEditor.drawStrokeAndExpectPixels(dialog)

    const clearButton = dialog.getByRole('button', { name: 'Clear' })
    await expect(clearButton).toBeVisible()
    await clearButton.click()

    await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(0)
  })

  test('cancel closes the dialog without saving', async ({ maskEditor }) => {
    const dialog = await maskEditor.openDialog()

    await maskEditor.drawStrokeAndExpectPixels(dialog)

    const cancelButton = dialog.getByRole('button', { name: 'Cancel' })
    await cancelButton.click()

    await expect(dialog).toBeHidden()
  })

  test('invert button inverts the mask', async ({ maskEditor }) => {
    const dialog = await maskEditor.openDialog()

    const dataBefore = await maskEditor.getCanvasPixelData(2)
    expect(dataBefore).not.toBeNull()
    const pixelsBefore = dataBefore!.nonTransparentPixels

    const invertButton = dialog.getByRole('button', { name: 'Invert' })
    await expect(invertButton).toBeVisible()
    await invertButton.click()

    await expect
      .poll(() => maskEditor.pollMaskPixelCount())
      .toBeGreaterThan(pixelsBefore)
  })

  test('keyboard shortcut Ctrl+Z triggers undo', async ({
    comfyPage,
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()

    await maskEditor.drawStrokeAndExpectPixels(dialog)

    const modifier = process.platform === 'darwin' ? 'Meta+z' : 'Control+z'
    await comfyPage.page.keyboard.press(modifier)

    await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(0)
  })

  test(
    'tool panel shows all five tools',
    { tag: ['@smoke'] },
    async ({ maskEditor }) => {
      const dialog = await maskEditor.openDialog()

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
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()

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
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()

    // The side panel should show brush settings by default
    const thicknessLabel = dialog.getByText('Thickness')
    await expect(thicknessLabel).toBeVisible()

    const opacityLabel = dialog.getByText('Opacity').first()
    await expect(opacityLabel).toBeVisible()

    const hardnessLabel = dialog.getByText('Hardness')
    await expect(hardnessLabel).toBeVisible()
  })

  test('save uploads all layers and closes dialog', async ({
    comfyPage,
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()

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

  test('save failure keeps dialog open', async ({ comfyPage, maskEditor }) => {
    const dialog = await maskEditor.openDialog()

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
    async ({ maskEditor }) => {
      const dialog = await maskEditor.openDialog()

      // Draw a stroke with the mask pen (default tool)
      await maskEditor.drawStrokeAndExpectPixels(dialog)

      const pixelsAfterDraw = await maskEditor.getCanvasPixelData(2)

      // Switch to eraser tool (3rd tool, index 2)
      const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
      await toolEntries.nth(2).click()

      // Draw over the same area with the eraser
      await maskEditor.drawStrokeOnPointerZone(dialog)

      await expect
        .poll(() => maskEditor.pollMaskPixelCount())
        .toBeLessThan(pixelsAfterDraw!.nonTransparentPixels)
    }
  )
})
