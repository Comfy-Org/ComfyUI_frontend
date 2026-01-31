import type { Locator, Page } from '@playwright/test'

import type { Position } from '../types'

export class CanvasHelper {
  constructor(
    private page: Page,
    private canvas: Locator,
    private resetViewButton: Locator
  ) {}

  private async nextFrame(): Promise<void> {
    await this.page.evaluate(() => {
      return new Promise<number>(requestAnimationFrame)
    })
  }

  async resetView(): Promise<void> {
    if (await this.resetViewButton.isVisible()) {
      await this.resetViewButton.click()
    }
    await this.page.mouse.move(10, 10)
    await this.nextFrame()
  }

  async zoom(deltaY: number, steps: number = 1): Promise<void> {
    await this.page.mouse.move(10, 10)
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, deltaY)
    }
    await this.nextFrame()
  }

  async pan(offset: Position, safeSpot?: Position): Promise<void> {
    safeSpot = safeSpot || { x: 10, y: 10 }
    await this.page.mouse.move(safeSpot.x, safeSpot.y)
    await this.page.mouse.down()
    await this.page.mouse.move(offset.x + safeSpot.x, offset.y + safeSpot.y)
    await this.page.mouse.up()
    await this.nextFrame()
  }

  async panWithTouch(offset: Position, safeSpot?: Position): Promise<void> {
    safeSpot = safeSpot || { x: 10, y: 10 }
    const client = await this.page.context().newCDPSession(this.page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [safeSpot]
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: offset.x + safeSpot.x, y: offset.y + safeSpot.y }]
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })
    await this.nextFrame()
  }

  async rightClick(x: number = 10, y: number = 10): Promise<void> {
    await this.page.mouse.click(x, y, { button: 'right' })
    await this.nextFrame()
  }

  async doubleClick(): Promise<void> {
    await this.page.mouse.dblclick(10, 10, { delay: 5 })
    await this.nextFrame()
  }

  async click(position: Position): Promise<void> {
    await this.canvas.click({ position })
    await this.nextFrame()
  }

  async clickEmptySpace(position: Position): Promise<void> {
    await this.canvas.click({ position })
    await this.nextFrame()
  }

  async dragAndDrop(source: Position, target: Position): Promise<void> {
    await this.page.mouse.move(source.x, source.y)
    await this.page.mouse.down()
    await this.page.mouse.move(target.x, target.y, { steps: 100 })
    await this.page.mouse.up()
    await this.nextFrame()
  }

  async moveMouseToEmptyArea(): Promise<void> {
    await this.page.mouse.move(10, 10)
  }

  async getScale(): Promise<number> {
    return this.page.evaluate(() => {
      return window['app'].canvas.ds.scale
    })
  }

  async setScale(scale: number): Promise<void> {
    await this.page.evaluate((s) => {
      window['app'].canvas.ds.scale = s
    }, scale)
    await this.nextFrame()
  }

  async convertOffsetToCanvas(
    pos: [number, number]
  ): Promise<[number, number]> {
    return this.page.evaluate((pos) => {
      return window['app'].canvas.ds.convertOffsetToCanvas(pos)
    }, pos)
  }

  async getNodeCenterByTitle(title: string): Promise<Position | null> {
    return this.page.evaluate((title) => {
      const app = window['app']
      const node = app.graph.nodes.find(
        (n: { title: string }) => n.title === title
      )
      if (!node) return null

      const centerX = node.pos[0] + node.size[0] / 2
      const centerY = node.pos[1] + node.size[1] / 2
      const [clientX, clientY] = app.canvasPosToClientPos([centerX, centerY])
      return { x: clientX, y: clientY }
    }, title)
  }
}
