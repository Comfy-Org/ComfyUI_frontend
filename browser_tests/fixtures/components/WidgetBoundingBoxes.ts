import type { Locator } from '@playwright/test'

export class WidgetBoundingBoxesFixture {
  public readonly root: Locator
  public readonly canvas: Locator
  public readonly drawingArea: Locator
  public readonly height: Locator

  constructor(node: Locator) {
    this.root = node.getByTestId('bounding-boxes')
    this.canvas = this.root.locator('canvas')
    this.drawingArea = this.canvas.locator('..')
    this.height = node.getByLabel('height').getByRole('spinbutton')
  }

  async drawBox(from: number, to: number): Promise<void> {
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Bounding boxes canvas is not visible')
    const mouse = this.canvas.page().mouse
    await mouse.move(box.x + box.width * from, box.y + box.height * from)
    await mouse.down()
    await mouse.move(box.x + box.width * to, box.y + box.height * to, {
      steps: 10
    })
    await mouse.up()
  }

  async setHeight(value: number): Promise<void> {
    await this.height.fill(String(value))
    await this.height.press('Enter')
  }

  async aspectRatio(): Promise<number> {
    const box = await this.drawingArea.boundingBox()
    if (!box) throw new Error('Bounding boxes drawing area is not visible')
    return box.width / box.height
  }
}
