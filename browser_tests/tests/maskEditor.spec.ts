import type { Locator } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { toNodeId } from '@/types/nodeId'

const wstest = mergeTests(test, webSocketFixture)

function getMinimumToolIconContrast(dialog: Locator): Promise<number> {
  return dialog
    .locator('.maskEditor_toolPanelContainer')
    .evaluateAll((toolButtons) => {
      type Color = {
        red: number
        green: number
        blue: number
        alpha: number
      }

      function parseColor(value: string) {
        const channels = value.match(/[\d.]+/g)?.map(Number) ?? []
        return {
          red: channels[0] ?? 0,
          green: channels[1] ?? 0,
          blue: channels[2] ?? 0,
          alpha: channels[3] ?? 1
        }
      }

      function composite(foreground: Color, background: Color): Color {
        const alpha =
          foreground.alpha + background.alpha * (1 - foreground.alpha)
        if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 }

        return {
          red:
            (foreground.red * foreground.alpha +
              background.red * background.alpha * (1 - foreground.alpha)) /
            alpha,
          green:
            (foreground.green * foreground.alpha +
              background.green * background.alpha * (1 - foreground.alpha)) /
            alpha,
          blue:
            (foreground.blue * foreground.alpha +
              background.blue * background.alpha * (1 - foreground.alpha)) /
            alpha,
          alpha
        }
      }

      function luminance({ red, green, blue }: Color) {
        const channels = [red, green, blue].map((channel) => {
          const normalized = channel / 255
          return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4
        })
        return (
          0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        )
      }

      function effectiveBackground(element: Element) {
        const backgrounds: Color[] = []
        let current: Element | null = element
        while (current) {
          backgrounds.push(
            parseColor(getComputedStyle(current).backgroundColor)
          )
          current = current.parentElement
        }

        return backgrounds.reduceRight(
          (background, foreground) => composite(foreground, background),
          { red: 255, green: 255, blue: 255, alpha: 1 }
        )
      }

      if (toolButtons.length === 0) return 0

      return Math.min(
        ...toolButtons.map((button) => {
          const icon = button.querySelector('svg')
          if (!icon) return 0

          const background = effectiveBackground(button)
          const foreground = composite(
            parseColor(getComputedStyle(icon).fill),
            background
          )
          const foregroundLuminance = luminance(foreground)
          const backgroundLuminance = luminance(background)
          const lighter = Math.max(foregroundLuminance, backgroundLuminance)
          const darker = Math.min(foregroundLuminance, backgroundLuminance)
          return (lighter + 0.05) / (darker + 0.05)
        })
      )
    })
}

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

      await dialog.getByTestId('pointer-zone').hover()
      await dialog.getByText('Brush Settings').hover()
      await expect(dialog.getByTestId('brush-cursor')).toHaveCSS('opacity', '0')

      await comfyPage.expectScreenshot(dialog, 'mask-editor-dialog-open.png')
    }
  )

  test(
    'opens mask editor from context menu',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage, maskEditor }) => {
      const { nodeId } = await maskEditor.loadImageOnNode()
      // Center the node so its header clears the view-mode toggle floating
      // at the top-left of the canvas.
      const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
      await nodeRef.centerOnNode()

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

  test(
    'Middle-click drag should pan the mask editor canvas',
    { tag: ['@canvas'] },
    async ({ comfyPage, comfyMouse, maskEditor }) => {
      const dialog = await maskEditor.openDialog()
      const pointerZone = dialog.getByTestId('pointer-zone')
      const getCanvasPosition = () =>
        comfyPage.page.evaluate(() => {
          const container = document.querySelector('#maskEditorCanvasContainer')
          if (!(container instanceof HTMLElement)) return null

          return {
            left: container.style.left,
            top: container.style.top
          }
        })
      const canvasPositionBefore = await getCanvasPosition()

      await comfyMouse.middleDragFromCenter(
        pointerZone,
        { x: 140, y: 90 },
        { steps: 10 }
      )

      await expect.poll(getCanvasPosition).not.toEqual(canvasPositionBefore)
    }
  )

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

  test(
    'tool icons remain visible in light and dark themes',
    { tag: ['@smoke'] },
    async ({ comfyPage, maskEditor }) => {
      const initialTheme = await comfyPage.menu.getThemeId()
      const alternateTheme = initialTheme === 'light' ? 'dark' : 'light'
      const dialog = await maskEditor.openDialog()

      try {
        await expect
          .poll(() => getMinimumToolIconContrast(dialog))
          .toBeGreaterThanOrEqual(3)

        await comfyPage.settings.setSetting(
          'Comfy.ColorPalette',
          alternateTheme
        )
        await expect
          .poll(() => getMinimumToolIconContrast(dialog))
          .toBeGreaterThanOrEqual(3)
      } finally {
        await comfyPage.settings.setSetting('Comfy.ColorPalette', initialTheme)
      }
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

    let imageUploadCount = 0

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

    // The save pipeline uploads four layers (masked, paint, painted, paintedMasked)
    // through the unified /upload/image endpoint.
    expect(
      imageUploadCount,
      'save should upload all four layers via /upload/image'
    ).toBe(4)
  })

  test('save failure keeps dialog open', async ({ comfyPage, maskEditor }) => {
    const dialog = await maskEditor.openDialog()

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

wstest(
  'Will not use stale litegraph previews',
  async ({ comfyPage, getWebSocket }) => {
    const executionHelper = new ExecutionHelper(comfyPage, await getWebSocket())
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.searchBoxV2.addNode('Preview Image')

    async function getNodeOutput() {
      return await comfyPage.page.evaluate(
        (nodeId) => graph!.getNodeById(nodeId)!.images?.[0]?.filename,
        toNodeId(1)
      )
    }

    executionHelper.executed('', '1', { images: [{ filename: 'test1.png' }] })
    await comfyPage.page.evaluate(() => app!.canvas.setDirty(true))
    await expect.poll(getNodeOutput).toBe('test1.png')

    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

    const resolvableFile = { filename: 'example.png', type: 'input' }
    executionHelper.executed('', '1', { images: [resolvableFile] })
    await expect.poll(getNodeOutput).toBe('example.png')

    const node = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
    await node.imagePreview.hover()
    await node.imagePreview
      .getByRole('button', { name: 'Edit or mask image' })
      .click()

    // On previous versions, attempting to open the mask editor here would
    // incorrectly reference the non-existant test1.png
    // This causes the mask editor to throw in setup and not display
    await expect(comfyPage.page.locator('.mask-editor-dialog')).toBeVisible()
  }
)
