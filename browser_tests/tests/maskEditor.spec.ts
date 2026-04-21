import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { MaskEditorDialog } from '@e2e/fixtures/components/MaskEditorDialog'

const OPEN_MASK_EDITOR_LABEL = 'Edit or mask image'

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

  async function openMaskEditorDialog(
    comfyPage: ComfyPage
  ): Promise<MaskEditorDialog> {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    await imagePreview.getByRole('region').hover()
    await comfyPage.page.getByLabel(OPEN_MASK_EDITOR_LABEL).click()

    const maskEditor = new MaskEditorDialog(comfyPage)
    await maskEditor.waitForOpen()
    return maskEditor
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

  async function drawStrokeOnPointerZone(page: Page, dialog: MaskEditorDialog) {
    await expect(dialog.pointerZone).toBeVisible()

    const box = await dialog.pointerZone.boundingBox()
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
    dialog: MaskEditorDialog
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
      await comfyPage.page.getByLabel(OPEN_MASK_EDITOR_LABEL).click()

      const dialog = new MaskEditorDialog(comfyPage)
      await dialog.waitForOpen()

      await expect(dialog.toolPanel).toBeVisible()
      await expect(dialog.saveButton).toBeVisible()
      await expect(dialog.cancelButton).toBeVisible()

      await comfyPage.expectScreenshot(
        dialog.root,
        'mask-editor-dialog-open.png'
      )
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

      const dialog = new MaskEditorDialog(comfyPage)
      await dialog.waitForOpen()

      await comfyPage.expectScreenshot(
        dialog.root,
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

  test(
    'Middle-click drag should pan the mask editor canvas',
    { tag: '@screenshot' },
    async ({ comfyPage, comfyMouse }) => {
      const dialog = await openMaskEditorDialog(comfyPage)
      const pointerBox = await dialog.getCanvasBoundingBox()

      const start = {
        x: pointerBox.x + pointerBox.width / 2,
        y: pointerBox.y + pointerBox.height / 2
      }

      await comfyMouse.mmbDrag(
        start,
        { x: start.x + 140, y: start.y + 90 },
        { steps: 10 }
      )

      // Move cursor outside the pointer zone so the brush cursor overlay is
      // hidden (PointerZone's pointerleave clears store.brushVisible). Without
      // this the brush circle lands on slightly different pixels between runs
      // and causes flaky screenshot diffs.
      await comfyPage.page.mouse.move(0, 0)

      await comfyPage.expectScreenshot(
        dialog.canvasContainer,
        'mask-editor-paned-with-mmb.png'
      )
    }
  )

  test('undo reverts a brush stroke', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    await expect(dialog.undoButton).toBeVisible()
    await dialog.undoButton.click()

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)
  })

  test('redo restores an undone stroke', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    await dialog.undoButton.click()

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)

    await expect(dialog.redoButton).toBeVisible()
    await dialog.redoButton.click()

    await expect
      .poll(() => pollMaskPixelCount(comfyPage.page))
      .toBeGreaterThan(0)
  })

  test('clear button removes all mask content', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    await expect(dialog.clearButton).toBeVisible()
    await dialog.clearButton.click()

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)
  })

  test('cancel closes the dialog without saving', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    await dialog.cancelButton.click()

    await expect(dialog.root).toBeHidden()
  })

  test('invert button inverts the mask', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    const dataBefore = await getMaskCanvasPixelData(comfyPage.page)
    expect(dataBefore).not.toBeNull()
    const pixelsBefore = dataBefore!.nonTransparentPixels

    await expect(dialog.invertButton).toBeVisible()
    await dialog.invertButton.click()

    await expect
      .poll(() => pollMaskPixelCount(comfyPage.page))
      .toBeGreaterThan(pixelsBefore)
  })

  test('keyboard shortcut Ctrl+Z triggers undo', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    await comfyPage.page.keyboard.press('ControlOrMeta+z')

    await expect.poll(() => pollMaskPixelCount(comfyPage.page)).toBe(0)
  })

  test(
    'tool panel shows all five tools',
    { tag: ['@smoke'] },
    async ({ comfyPage }) => {
      const dialog = await openMaskEditorDialog(comfyPage)

      await expect(dialog.toolPanel).toBeVisible()

      // The tool panel should contain exactly 5 tool entries
      await expect(dialog.toolEntries).toHaveCount(5)

      // First tool (MaskPen) should be selected by default
      await expect(dialog.selectedTool).toHaveCount(1)
    }
  )

  test('switching tools updates the selected indicator', async ({
    comfyPage
  }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await expect(dialog.toolEntries).toHaveCount(5)

    // Click the third tool (Eraser, index 2)
    await dialog.toolEntries.nth(2).click()

    // The third tool should now be selected
    await expect(dialog.selectedTool).toHaveCount(1)

    // Verify it's the eraser (3rd entry)
    await expect(dialog.toolEntries.nth(2)).toHaveClass(/Selected/)
  })

  test('brush settings panel is visible with thickness controls', async ({
    comfyPage
  }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    // The side panel should show brush settings by default
    await expect(dialog.thicknessLabel).toBeVisible()
    await expect(dialog.opacityLabel).toBeVisible()
    await expect(dialog.hardnessLabel).toBeVisible()
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

    await expect(dialog.saveButton).toBeVisible()
    await dialog.saveButton.click()

    await expect(dialog.root).toBeHidden()

    // The save pipeline uploads the mask plus at least one image layer.
    // Pinning >=1 of each catches regressions where either branch silently
    // short-circuits, which the prior `sum > 0` assertion would not.
    expect(maskUploadCount, 'mask upload should fire').toBeGreaterThanOrEqual(1)
    expect(imageUploadCount, 'image upload should fire').toBeGreaterThanOrEqual(
      1
    )
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

    await dialog.saveButton.click()

    // Dialog should remain open when save fails
    await expect(dialog.root).toBeVisible()
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
      await dialog.toolEntries.nth(2).click()

      // Draw over the same area with the eraser
      await drawStrokeOnPointerZone(comfyPage.page, dialog)

      await expect
        .poll(() => pollMaskPixelCount(comfyPage.page))
        .toBeLessThan(pixelsAfterDraw!.nonTransparentPixels)
    }
  )
})
