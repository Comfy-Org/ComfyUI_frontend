import type { Locator, Page } from '@playwright/test'

import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import type { Position } from '@e2e/fixtures/types'
import { nextFrame } from '@e2e/fixtures/utils/timing'

export class CanvasHelper {
  constructor(
    private page: Page,
    private canvas: Locator,
    private resetViewButton: Locator
  ) {}

  async resetView(): Promise<void> {
    if (await this.resetViewButton.isVisible()) {
      await this.resetViewButton.click()
    }
    await this.page.mouse.move(10, 10)
    await nextFrame(this.page)
  }

  async zoom(deltaY: number, steps: number = 1): Promise<void> {
    await this.page.mouse.move(10, 10)
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, deltaY)
    }
    await nextFrame(this.page)
  }

  async pan(offset: Position, safeSpot?: Position): Promise<void> {
    safeSpot = safeSpot || { x: 10, y: 10 }
    await this.page.mouse.move(safeSpot.x, safeSpot.y)
    await this.page.mouse.down()
    await this.page.mouse.move(offset.x + safeSpot.x, offset.y + safeSpot.y)
    await this.page.mouse.up()
    await nextFrame(this.page)
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
    await nextFrame(this.page)
  }

  async rightClick(x: number = 10, y: number = 10): Promise<void> {
    await this.page.mouse.click(x, y, { button: 'right' })
    await nextFrame(this.page)
  }

  async doubleClick(): Promise<void> {
    await this.page.mouse.dblclick(10, 10, { delay: 5 })
    await nextFrame(this.page)
  }

  async click(position: Position): Promise<void> {
    await this.canvas.click({ position })
    await nextFrame(this.page)
  }

  /**
   * Convert a canvas-element-relative position to absolute page coordinates.
   * Use with `page.mouse` APIs when Vue DOM overlays above the canvas would
   * cause Playwright's actionability check to fail on the canvas locator.
   */
  private async toAbsolute(position: Position): Promise<Position> {
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')
    return { x: box.x + position.x, y: box.y + position.y }
  }

  /**
   * Click at canvas-element-relative coordinates using `page.mouse.click()`.
   * Bypasses Playwright's actionability checks on the canvas locator, which
   * can fail when Vue-rendered DOM nodes overlay the `<canvas>` element.
   */
  async mouseClickAt(
    position: Position,
    options?: {
      button?: 'left' | 'right' | 'middle'
      modifiers?: ('Shift' | 'Control' | 'Alt' | 'Meta')[]
    }
  ): Promise<void> {
    const abs = await this.toAbsolute(position)
    const modifiers = options?.modifiers ?? []
    for (const mod of modifiers) await this.page.keyboard.down(mod)
    try {
      await this.page.mouse.click(abs.x, abs.y, {
        button: options?.button
      })
    } finally {
      for (const mod of modifiers) await this.page.keyboard.up(mod)
    }
    await nextFrame(this.page)
  }

  /**
   * Double-click at canvas-element-relative coordinates using `page.mouse`.
   */
  async mouseDblclickAt(position: Position): Promise<void> {
    const abs = await this.toAbsolute(position)
    await this.page.mouse.dblclick(abs.x, abs.y)
    await nextFrame(this.page)
  }

  async clickEmptySpace(): Promise<void> {
    await this.canvas.click({ position: DefaultGraphPositions.emptySpaceClick })
    await nextFrame(this.page)
  }

  async dragAndDrop(source: Position, target: Position): Promise<void> {
    await this.page.mouse.move(source.x, source.y)
    await this.page.mouse.down()
    await this.page.mouse.move(target.x, target.y, { steps: 100 })
    await this.page.mouse.up()
    await nextFrame(this.page)
  }

  async moveMouseToEmptyArea(): Promise<void> {
    await this.page.mouse.move(10, 10)
  }

  async isReadOnly(): Promise<boolean> {
    return this.page.evaluate(() => {
      return window.app!.canvas.state.readOnly
    })
  }

  async getScale(): Promise<number> {
    return this.page.evaluate(() => {
      return window.app!.canvas.ds.scale
    })
  }

  async setScale(scale: number): Promise<void> {
    await this.page.evaluate((s) => {
      window.app!.canvas.ds.scale = s
    }, scale)
    await nextFrame(this.page)
  }

  async convertOffsetToCanvas(
    pos: [number, number]
  ): Promise<[number, number]> {
    return this.page.evaluate((pos) => {
      return window.app!.canvas.ds.convertOffsetToCanvas(pos)
    }, pos)
  }

  async getNodeCenterByTitle(title: string): Promise<Position | null> {
    return this.page.evaluate((title) => {
      const app = window.app!
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

  async getGroupPosition(title: string): Promise<Position> {
    const pos = await this.page.evaluate((title) => {
      const groups = window.app!.graph.groups
      const group = groups.find((g: { title: string }) => g.title === title)
      if (!group) return null
      return { x: group.pos[0], y: group.pos[1] }
    }, title)
    if (!pos) throw new Error(`Group "${title}" not found`)
    return pos
  }

  async dragGroup(options: {
    name: string
    deltaX: number
    deltaY: number
  }): Promise<void> {
    const { name, deltaX, deltaY } = options
    const screenPos = await this.page.evaluate((title) => {
      const app = window.app!
      const groups = app.graph.groups
      const group = groups.find((g: { title: string }) => g.title === title)
      if (!group) return null
      const clientPos = app.canvasPosToClientPos([
        group.pos[0] + 50,
        group.pos[1] + 15
      ])
      return { x: clientPos[0], y: clientPos[1] }
    }, name)
    if (!screenPos) throw new Error(`Group "${name}" not found`)

    await this.dragAndDrop(screenPos, {
      x: screenPos.x + deltaX,
      y: screenPos.y + deltaY
    })
  }

  /**
   * Pan the canvas back and forth in a sweep pattern using middle-mouse drag.
   * Each step advances one animation frame, giving per-frame measurement
   * granularity for performance tests.
   */
  async panSweep(options?: {
    steps?: number
    dx?: number
    dy?: number
  }): Promise<void> {
    const { steps = 120, dx = 8, dy = 3 } = options ?? {}
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await this.page.mouse.move(centerX, centerY)
    await this.page.mouse.down({ button: 'middle' })

    // Sweep forward
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.move(centerX + i * dx, centerY + i * dy)
      await nextFrame(this.page)
    }
    // Sweep back
    for (let i = steps; i > 0; i--) {
      await this.page.mouse.move(centerX + i * dx, centerY + i * dy)
      await nextFrame(this.page)
    }

    await this.page.mouse.up({ button: 'middle' })
  }

  async disconnectEdge(): Promise<void> {
    await this.dragAndDrop(
      DefaultGraphPositions.clipTextEncodeNode1InputSlot,
      DefaultGraphPositions.emptySpace
    )
  }

  async connectEdge(options: { reverse?: boolean } = {}): Promise<void> {
    const { reverse = false } = options
    const start = reverse
      ? DefaultGraphPositions.clipTextEncodeNode1InputSlot
      : DefaultGraphPositions.loadCheckpointNodeClipOutputSlot
    const end = reverse
      ? DefaultGraphPositions.loadCheckpointNodeClipOutputSlot
      : DefaultGraphPositions.clipTextEncodeNode1InputSlot

    await this.dragAndDrop(start, end)
  }
}
