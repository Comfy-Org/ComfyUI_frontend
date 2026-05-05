import { expect } from '@playwright/test'

import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'

const RGB_PAINT_TOOL_INDEX = 1 // RGB / color paint tool
const ERASER_TOOL_INDEX = 2 // Eraser tool

test.describe(
  'Mask Editor brush adjustment and layer management',
  { tag: '@vue-nodes' },
  () => {
    test.describe('Brush settings interaction', () => {
      test('Adjusting brush thickness slider changes stroke output', async ({
        comfyPage,
        maskEditor
      }) => {
        const dialog = await maskEditor.openDialog()
        const thicknessInput = maskEditor.brushInput(dialog, 'thickness')

        // Thin brush
        await thicknessInput.fill('2')
        await expect(thicknessInput).toHaveValue('2')

        await maskEditor.drawStrokeOnPointerZone(dialog)
        await expect
          .poll(() => maskEditor.pollMaskPixelCount())
          .toBeGreaterThan(0)
        const thinPixels = await maskEditor.pollMaskPixelCount()

        await comfyPage.page.keyboard.press('Control+z')
        await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(0)

        // Thick brush
        await thicknessInput.fill('200')
        await expect(thicknessInput).toHaveValue('200')

        await maskEditor.drawStrokeOnPointerZone(dialog)
        await expect
          .poll(() => maskEditor.pollMaskPixelCount())
          .toBeGreaterThan(thinPixels)
      })
    })

    test.describe('Layer management', () => {
      test('Drawing on different tools produces independent mask data', async ({
        maskEditor
      }) => {
        const dialog = await maskEditor.openDialog()

        await maskEditor.drawStrokeOnPointerZone(dialog)
        await expect
          .poll(() => maskEditor.pollMaskPixelCount())
          .toBeGreaterThan(0)
        const maskSnapshotAfterPen = await maskEditor.getCanvasSnapshot(2)

        const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
        await expect(toolEntries).toHaveCount(5)
        await toolEntries.nth(RGB_PAINT_TOOL_INDEX).click()
        await expect(toolEntries.nth(RGB_PAINT_TOOL_INDEX)).toHaveClass(
          /Selected/
        )

        await maskEditor.drawStrokeOnPointerZone(dialog)
        await expect
          .poll(() => maskEditor.pollRgbPixelCount())
          .toBeGreaterThan(0)

        await expect
          .poll(() => maskEditor.getCanvasSnapshot(2))
          .toBe(maskSnapshotAfterPen)
      })

      test("Switching between tools preserves previous tool's mask data", async ({
        maskEditor
      }) => {
        const dialog = await maskEditor.openDialog()

        await maskEditor.drawStrokeOnPointerZone(dialog)
        await expect
          .poll(() => maskEditor.pollMaskPixelCount())
          .toBeGreaterThan(0)

        const maskSnapshot = await maskEditor.getCanvasSnapshot(2)

        const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
        await expect(toolEntries).toHaveCount(5)

        await toolEntries.nth(ERASER_TOOL_INDEX).click()
        await expect(toolEntries.nth(ERASER_TOOL_INDEX)).toHaveClass(/Selected/)

        await toolEntries.nth(0).click()
        await expect(toolEntries.nth(0)).toHaveClass(/Selected/)

        await expect
          .poll(() => maskEditor.getCanvasSnapshot(2))
          .toBe(maskSnapshot)
      })
    })
  }
)
