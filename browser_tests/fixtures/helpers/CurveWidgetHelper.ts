import type { Locator, Page } from '@playwright/test'

export class CurveWidgetHelper {
  constructor(
    public readonly page: Page,
    public readonly svgLocator: Locator
  ) {}

  async clickAt(curveX: number, curveY: number): Promise<void> {
    const box = await this.svgLocator.boundingBox()
    if (!box) throw new Error('SVG not found')
    const viewBoxExtent = 1.08
    const padFraction = 0.04 / viewBoxExtent
    const usableSize = box.width / viewBoxExtent
    const screenX = box.x + box.width * padFraction + curveX * usableSize
    const screenY = box.y + box.height * padFraction + (1 - curveY) * usableSize
    await this.page.mouse.click(screenX, screenY)
  }

  async dragPoint(
    pointIndex: number,
    toCurveX: number,
    toCurveY: number
  ): Promise<void> {
    const circle = this.svgLocator.locator('circle').nth(pointIndex)
    const circleBox = await circle.boundingBox()
    if (!circleBox) throw new Error('Circle not found')
    const fromX = circleBox.x + circleBox.width / 2
    const fromY = circleBox.y + circleBox.height / 2

    const svgBox = await this.svgLocator.boundingBox()
    if (!svgBox) throw new Error('SVG not found')
    const viewBoxExtent = 1.08
    const padFraction = 0.04 / viewBoxExtent
    const usableSize = svgBox.width / viewBoxExtent
    const toScreenX =
      svgBox.x + svgBox.width * padFraction + toCurveX * usableSize
    const toScreenY =
      svgBox.y + svgBox.height * padFraction + (1 - toCurveY) * usableSize

    await this.page.mouse.move(fromX, fromY)
    await this.page.mouse.down()
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      await this.page.mouse.move(
        fromX + ((toScreenX - fromX) * i) / steps,
        fromY + ((toScreenY - fromY) * i) / steps
      )
    }
    await this.page.mouse.up()
  }

  async rightClickPoint(pointIndex: number): Promise<void> {
    const circle = this.svgLocator.locator('circle').nth(pointIndex)
    await circle.dispatchEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
  }

  async getCurveData(): Promise<
    { points: [number, number][]; interpolation: string } | undefined
  > {
    return this.page.evaluate(() => {
      const node = window.app!.graph.nodes.find((n) =>
        n.widgets?.some((w) => w.type === 'CURVE')
      )
      return node?.widgets?.find((w) => w.type === 'CURVE')?.value as
        | { points: [number, number][]; interpolation: string }
        | undefined
    })
  }
}
