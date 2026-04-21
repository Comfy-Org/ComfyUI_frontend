import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class MaskEditorDialog {
  public readonly root: Locator
  public readonly canvasContainer: Locator
  public readonly pointerZone: Locator

  constructor(public readonly comfyPage: ComfyPage) {
    this.root = comfyPage.page.locator('.mask-editor-dialog')
    this.canvasContainer = this.root.locator('#maskEditorCanvasContainer')
    this.pointerZone = this.root.getByTestId('mask-editor-pointer-zone')
  }

  async waitForOpen(): Promise<void> {
    await expect(this.root).toBeVisible()
    await expect(
      this.root.getByRole('heading', { name: 'Mask Editor' })
    ).toBeVisible()
    await expect(this.canvasContainer).toBeVisible()
    await expect(this.canvasContainer.locator('canvas')).toHaveCount(4)
  }

  async getCanvasBoundingBox() {
    await expect(this.canvasContainer).toBeVisible()
    const box = await this.canvasContainer.boundingBox()
    if (!box)
      throw new Error('Mask editor canvas container bounding box not found')
    return box
  }
}
