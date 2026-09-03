import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import type { Position } from '@e2e/fixtures/types'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import type { Point } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'
import type { RerouteId } from '@/types/rerouteId'

type NodeGeometry = {
  inputs: Point[]
  outputs: Point[]
  pos: Point
  size: Point
}

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

  async panWithTouch(
    offset: Position,
    safeSpot?: Position,
    steps: number = 1
  ): Promise<void> {
    if (!Number.isInteger(steps) || steps <= 0) {
      throw new RangeError('steps must be a finite positive integer')
    }
    safeSpot = safeSpot || { x: 10, y: 10 }
    const client = await this.page.context().newCDPSession(this.page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [safeSpot]
    })
    for (let step = 1; step <= steps; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: safeSpot.x + (offset.x * step) / steps,
            y: safeSpot.y + (offset.y * step) / steps
          }
        ]
      })
    }
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
  async toAbsolute(position: Position): Promise<Position> {
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
    await this.page.mouse.dblclick(abs.x, abs.y, { delay: 5 })
    await nextFrame(this.page)
  }

  async clickEmptySpace(): Promise<void> {
    await this.canvas.click({ position: DefaultGraphPositions.emptySpaceClick })
    await nextFrame(this.page)
  }

  async dragAndDrop(source: Position, target: Position): Promise<void> {
    await this.page.mouse.move(source.x, source.y)
    await this.page.mouse.down()
    await this.page.mouse.move(target.x, target.y, { steps: 20 })
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

  async getOffset(): Promise<[number, number]> {
    return this.page.evaluate(
      () => [...window.app!.canvas.ds.offset] as [number, number]
    )
  }

  async getNodeTitleHeight(): Promise<number> {
    return this.page.evaluate(() => window.LiteGraph!.NODE_TITLE_HEIGHT)
  }

  /**
   * Hold `Control+Shift` and drag from `from` to `to` using page-absolute
   * coordinates.
   */
  async ctrlShiftDrag(from: Position, to: Position): Promise<void> {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.down('Shift')
    await this.dragAndDrop(from, to)
    await this.page.keyboard.up('Shift')
    await this.page.keyboard.up('Control')
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

  async getNodeGeometry(nodeId: NodeId): Promise<NodeGeometry> {
    return this.page.evaluate((id): NodeGeometry => {
      const node = window.app?.canvas.graph?.getNodeById(id)
      if (!node) throw new Error(`Node ${id} not found`)

      return {
        pos: [node.pos[0], node.pos[1]],
        size: [node.size[0], node.size[1]],
        inputs: node.inputs.map((_, i) => node.getInputPos(i)),
        outputs: node.outputs.map((_, i) => node.getOutputPos(i))
      }
    }, nodeId)
  }

  expectSlotsTrackedNode(after: NodeGeometry, before: NodeGeometry): void {
    const dx = after.pos[0] - before.pos[0]
    const dy = after.pos[1] - before.pos[1]
    expect(Math.abs(dx) + Math.abs(dy), 'drag moved the node').toBeGreaterThan(
      1
    )

    const beforeSlots = [...before.inputs, ...before.outputs]
    const afterSlots = [...after.inputs, ...after.outputs]
    expect(afterSlots, 'slot count after drag').toHaveLength(beforeSlots.length)
    afterSlots.forEach(([x, y], i) => {
      expect(x, `slot ${i} x tracked the node`).toBeCloseTo(
        beforeSlots[i][0] + dx,
        0
      )
      expect(y, `slot ${i} y tracked the node`).toBeCloseTo(
        beforeSlots[i][1] + dy,
        0
      )
    })
  }

  expectNodeGeometryPreserved(
    actual: NodeGeometry,
    reference: NodeGeometry,
    label: string
  ): void {
    expect(actual.pos[0], `${label}: x`).toBeCloseTo(reference.pos[0], 0)
    expect(actual.pos[1], `${label}: y`).toBeCloseTo(reference.pos[1], 0)
    expect(actual.size, `${label}: size`).toEqual(reference.size)

    const referenceSlots = [...reference.inputs, ...reference.outputs]
    const actualSlots = [...actual.inputs, ...actual.outputs]
    expect(actualSlots, `${label}: slot count`).toHaveLength(
      referenceSlots.length
    )
    actualSlots.forEach(([x, y], i) => {
      expect(x, `${label}: slot ${i} x`).toBeCloseTo(referenceSlots[i][0], 0)
      expect(y, `${label}: slot ${i} y`).toBeCloseTo(referenceSlots[i][1], 0)
    })
  }

  expectSlotsOnNode(geometry: NodeGeometry, label: string): void {
    const [x, y] = geometry.pos
    const [width, height] = geometry.size
    const slots = [...geometry.inputs, ...geometry.outputs]

    slots.forEach(([slotX, slotY], i) => {
      expect(slotX, `${label}: slot ${i} x within node`).toBeGreaterThanOrEqual(
        x - 20
      )
      expect(slotX, `${label}: slot ${i} x within node`).toBeLessThanOrEqual(
        x + width + 20
      )
      expect(slotY, `${label}: slot ${i} y within node`).toBeGreaterThanOrEqual(
        y - 50
      )
      expect(slotY, `${label}: slot ${i} y within node`).toBeLessThanOrEqual(
        y + height + 20
      )
    })
  }

  async expectRootReroutePositions(
    expectedReroutes: Record<RerouteId, Position>
  ): Promise<void> {
    await expect(async () => {
      const reroutes = await this.page.evaluate(() => {
        const graph = window.app!.canvas.graph?.rootGraph
        if (!graph) throw new Error('Graph not available')
        return [...graph.reroutes.values()].map((reroute) => ({
          id: reroute.id,
          x: reroute.pos[0],
          y: reroute.pos[1]
        }))
      })

      expect(reroutes).toHaveLength(Object.keys(expectedReroutes).length)
      for (const reroute of reroutes) {
        const expected = expectedReroutes[reroute.id]
        if (!expected) throw new Error(`Unexpected reroute ${reroute.id}`)
        expect(reroute.x).toBeCloseTo(expected.x, 1)
        expect(reroute.y).toBeCloseTo(expected.y, 1)
      }
    }).toPass({ timeout: 5000 })
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

  async disconnectEdge(
    options: { modifiers?: ('Shift' | 'Control' | 'Alt' | 'Meta')[] } = {}
  ): Promise<void> {
    const { modifiers = [] } = options
    for (const mod of modifiers) await this.page.keyboard.down(mod)
    try {
      await this.dragAndDrop(
        DefaultGraphPositions.clipTextEncodeNode1InputSlot,
        DefaultGraphPositions.emptySpace
      )
    } finally {
      for (const mod of modifiers) await this.page.keyboard.up(mod)
    }
  }

  async middleClick(position: Position): Promise<void> {
    await this.mouseClickAt(position, { button: 'middle' })
  }

  async dblclickGroupTitle(title: string): Promise<void> {
    const clientPos = await this.page.evaluate((targetTitle) => {
      const groups = window.app!.canvas.graph?.groups ?? []
      const group = groups.find(
        (g: { title: string }) => g.title === targetTitle
      )
      if (!group) return null
      const cx = group.pos[0] + group.size[0] / 2
      const cy = group.pos[1] + group.titleHeight / 2
      return window.app!.canvasPosToClientPos([cx, cy])
    }, title)
    if (!clientPos) throw new Error(`Group "${title}" not found`)
    await this.page.mouse.dblclick(clientPos[0], clientPos[1], { delay: 5 })
    await nextFrame(this.page)
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
