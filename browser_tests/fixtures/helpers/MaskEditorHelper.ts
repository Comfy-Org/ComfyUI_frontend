import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const MASK_CANVAS_INDEX = 2
const RGB_CANVAS_INDEX = 1

export type BrushSliderLabel = 'thickness'

export class MaskEditorHelper {
  constructor(private comfyPage: ComfyPage) {}

  private get page() {
    return this.comfyPage.page
  }

  async loadImageOnNode() {
    await this.comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const loadImageNode = (
      await this.comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    )[0]
    const { x, y } = await loadImageNode.getPosition()

    await this.comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y }
    })

    const imagePreview = this.page.locator('.image-preview')
    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.locator('img')).toBeVisible()
    await expect(imagePreview).toContainText('x')

    return {
      imagePreview,
      nodeId: String(loadImageNode.id)
    }
  }

  async openDialog(): Promise<Locator> {
    const { imagePreview } = await this.loadImageOnNode()

    await imagePreview.getByRole('region').hover()
    await this.page.getByLabel('Edit or mask image').click()

    const dialog = this.page.locator('.mask-editor-dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('heading', { name: 'Mask Editor' })
    ).toBeVisible()

    const canvasContainer = dialog.locator('#maskEditorCanvasContainer')
    await expect(canvasContainer).toBeVisible()
    await expect(canvasContainer.locator('canvas')).toHaveCount(4)

    return dialog
  }

  async drawStrokeOnPointerZone(dialog: Locator) {
    const pointerZone = dialog.getByTestId('pointer-zone')
    await expect(pointerZone).toBeVisible()

    const box = await pointerZone.boundingBox()
    if (!box) throw new Error('Pointer zone bounding box not found')

    const startX = box.x + box.width * 0.3
    const startY = box.y + box.height * 0.5
    const endX = box.x + box.width * 0.7
    const endY = box.y + box.height * 0.5

    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(endX, endY, { steps: 10 })
    await this.page.mouse.up()

    return { startX, startY, endX, endY, box }
  }

  async drawStrokeAndExpectPixels(dialog: Locator) {
    await this.drawStrokeOnPointerZone(dialog)
    await expect.poll(() => this.pollMaskPixelCount()).toBeGreaterThan(0)
  }

  getCanvasPixelData(canvasIndex: number) {
    return this.page.evaluate((idx) => {
      const canvases = document.querySelectorAll(
        '#maskEditorCanvasContainer canvas'
      )
      const canvas = canvases[idx] as HTMLCanvasElement | undefined
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

  pollMaskPixelCount(): Promise<number> {
    return this.getCanvasPixelData(MASK_CANVAS_INDEX).then(
      (d) => d?.nonTransparentPixels ?? 0
    )
  }

  pollRgbPixelCount(): Promise<number> {
    return this.getCanvasPixelData(RGB_CANVAS_INDEX).then(
      (d) => d?.nonTransparentPixels ?? 0
    )
  }

  getCanvasSnapshot(canvasIndex: number): Promise<string> {
    return this.page.evaluate((idx) => {
      const canvas = document.querySelectorAll(
        '#maskEditorCanvasContainer canvas'
      )[idx] as HTMLCanvasElement | undefined
      return canvas?.toDataURL() ?? ''
    }, canvasIndex)
  }

  brushInput(dialog: Locator, label: BrushSliderLabel): Locator {
    return dialog.getByTestId(`brush-${label}-input`)
  }
}

export const maskEditorTest = comfyPageFixture.extend<{
  maskEditor: MaskEditorHelper
}>({
  maskEditor: async ({ comfyPage }, use) => {
    await use(new MaskEditorHelper(comfyPage))
  }
})
