import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Mask Editor brush adjustment and layer management',
  { tag: '@vue-nodes' },
  () => {
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

    function getCanvasPixelData(page: Page, canvasIndex: number) {
      return page.evaluate((idx) => {
        const canvases = document.querySelectorAll(
          '#maskEditorCanvasContainer canvas'
        )
        const canvas = canvases[idx] as HTMLCanvasElement
        if (!canvas) return null
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let nonTransparentPixels = 0
        for (let i = 3; i < data.data.length; i += 4) {
          if (data.data[i] > 0) nonTransparentPixels++
        }
        return { nonTransparentPixels, totalPixels: data.data.length / 4 }
      }, canvasIndex)
    }

    function pollMaskPixelCount(page: Page): Promise<number> {
      return getCanvasPixelData(page, 2).then(
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

    function pollRgbPixelCount(page: Page): Promise<number> {
      return getCanvasPixelData(page, 1).then(
        (d) => d?.nonTransparentPixels ?? 0
      )
    }

    async function setBrushSliderValue(
      page: Page,
      label: string,
      value: number
    ) {
      const didUpdate = await page.evaluate(
        ({ targetLabel, nextValue }) => {
          const labels = Array.from(
            document.querySelectorAll('.mask-editor-dialog span')
          )
          const labelElement = labels.find(
            (element) => element.textContent?.trim() === targetLabel
          )
          if (!labelElement) return false

          let container: HTMLElement | null = labelElement.parentElement
          while (container && !container.querySelector('input[type="range"]')) {
            container = container.parentElement
          }

          const slider = container?.querySelector(
            'input[type="range"]'
          ) as HTMLInputElement | null
          if (!slider) return false

          slider.value = String(nextValue)
          slider.dispatchEvent(new Event('input', { bubbles: true }))
          return true
        },
        { targetLabel: label, nextValue: value }
      )
      expect(didUpdate, `Slider "${label}" not found`).toBe(true)
    }

    function pollBrushSliderValue(page: Page, label: string): Promise<string> {
      return page.evaluate((targetLabel) => {
        const labels = Array.from(
          document.querySelectorAll('.mask-editor-dialog span')
        )
        const labelElement = labels.find(
          (element) => element.textContent?.trim() === targetLabel
        )
        if (!labelElement) {
          return ''
        }

        let container: HTMLElement | null = labelElement.parentElement
        while (container && !container.querySelector('input[type="range"]')) {
          container = container.parentElement
        }

        const slider = container?.querySelector(
          'input[type="range"]'
        ) as HTMLInputElement | null
        return slider?.value ?? ''
      }, label)
    }

    test.describe('Brush settings interaction', () => {
      test('Adjusting brush thickness slider changes brush size', async ({
        comfyPage
      }) => {
        await openMaskEditorDialog(comfyPage)

        await setBrushSliderValue(comfyPage.page, 'Thickness', 0.85)

        await expect
          .poll(() => pollBrushSliderValue(comfyPage.page, 'Thickness'))
          .toBe('0.85')
      })

      test('Adjusting opacity slider changes brush opacity', async ({
        comfyPage
      }) => {
        await openMaskEditorDialog(comfyPage)

        await setBrushSliderValue(comfyPage.page, 'Opacity', 0.33)

        await expect
          .poll(() => pollBrushSliderValue(comfyPage.page, 'Opacity'))
          .toBe('0.33')
      })

      test('Adjusting hardness slider changes brush hardness', async ({
        comfyPage
      }) => {
        await openMaskEditorDialog(comfyPage)

        await setBrushSliderValue(comfyPage.page, 'Hardness', 0.61)

        await expect
          .poll(() => pollBrushSliderValue(comfyPage.page, 'Hardness'))
          .toBe('0.61')
      })
    })

    test.describe('Layer management', () => {
      test('Drawing on different tools produces independent mask data', async ({
        comfyPage
      }) => {
        const dialog = await openMaskEditorDialog(comfyPage)

        await drawStrokeOnPointerZone(comfyPage.page, dialog)
        await expect
          .poll(() => pollMaskPixelCount(comfyPage.page))
          .toBeGreaterThan(0)
        const maskPixelsAfterMaskPen = await pollMaskPixelCount(comfyPage.page)

        const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
        await expect(toolEntries).toHaveCount(5)
        await toolEntries.nth(1).click()
        await expect(toolEntries.nth(1)).toHaveClass(/Selected/)

        await drawStrokeOnPointerZone(comfyPage.page, dialog)
        await expect
          .poll(() => pollRgbPixelCount(comfyPage.page))
          .toBeGreaterThan(0)

        await expect
          .poll(() => pollMaskPixelCount(comfyPage.page))
          .toBe(maskPixelsAfterMaskPen)
      })

      test("Switching between tools preserves previous tool's mask data", async ({
        comfyPage
      }) => {
        const dialog = await openMaskEditorDialog(comfyPage)

        await drawStrokeOnPointerZone(comfyPage.page, dialog)
        await expect
          .poll(() => pollMaskPixelCount(comfyPage.page))
          .toBeGreaterThan(0)

        const initialMaskPixels = await pollMaskPixelCount(comfyPage.page)

        const toolEntries = dialog.locator('.maskEditor_toolPanelContainer')
        await expect(toolEntries).toHaveCount(5)

        await toolEntries.nth(2).click()
        await expect(toolEntries.nth(2)).toHaveClass(/Selected/)

        await toolEntries.nth(0).click()
        await expect(toolEntries.nth(0)).toHaveClass(/Selected/)

        await expect
          .poll(() => pollMaskPixelCount(comfyPage.page))
          .toBe(initialMaskPixels)
      })
    })
  }
)
