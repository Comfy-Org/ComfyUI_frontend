import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/litegraph'

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function setCssSize(canvas: HTMLCanvasElement, width: number, height: number) {
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width, height })
  })
}

describe('DragAndScale.fitToBounds', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1
    })
  })

  it('returns early when element width is 0', () => {
    const dragAndScale = new DragAndScale(createCanvas(0, 400))

    dragAndScale.offset = [13, 29]
    dragAndScale.scale = 2

    dragAndScale.fitToBounds([0, 0, 500, 500])

    expect(dragAndScale.offset).toEqual([13, 29])
    expect(dragAndScale.scale).toBe(2)
  })

  it('returns early when element height is 0', () => {
    const dragAndScale = new DragAndScale(createCanvas(400, 0))

    dragAndScale.offset = [7, 11]
    dragAndScale.scale = 0.6

    dragAndScale.fitToBounds([0, 0, 500, 500])

    expect(dragAndScale.offset).toEqual([7, 11])
    expect(dragAndScale.scale).toBe(0.6)
  })

  it('uses fallback 1920x1080 when canvas is 300x150', () => {
    const dragAndScale = new DragAndScale(createCanvas(300, 150))

    dragAndScale.fitToBounds([0, 0, 600, 600])

    expect(dragAndScale.scale).toBeCloseTo(1.35)
  })

  it('calculates the correct scale for normal dimensions', () => {
    const dragAndScale = new DragAndScale(createCanvas(1000, 500))

    dragAndScale.fitToBounds([0, 0, 500, 250])

    expect(dragAndScale.scale).toBeCloseTo(1.25)
    expect(dragAndScale.offset[0]).toBeCloseTo(150)
    expect(dragAndScale.offset[1]).toBeCloseTo(75)
  })

  it('uses CSS dimensions when the backing store has sub-1 DPR dimensions', () => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 0.5
    })
    const canvas = createCanvas(400, 250)
    setCssSize(canvas, 800, 500)
    const dragAndScale = new DragAndScale(canvas)

    dragAndScale.fitToBounds([0, 0, 500, 250])
    dragAndScale.computeVisibleArea(undefined)

    expect(dragAndScale.scale).toBeCloseTo(1.2)
    expect(dragAndScale.visible_area.width).toBeCloseTo(800 / 1.2)
    expect(dragAndScale.visible_area.height).toBeCloseTo(500 / 1.2)
  })

  it('uses the applied viewport size without reading layout each frame', () => {
    const canvas = createCanvas(1600, 1200)
    const dragAndScale = new DragAndScale(canvas)
    const rectSpy = vi.spyOn(canvas, 'getBoundingClientRect')
    dragAndScale.setViewportSize(800, 600)

    dragAndScale.computeVisibleArea(undefined)

    expect(rectSpy).not.toHaveBeenCalled()
    expect(dragAndScale.visible_area.width).toBe(800)
    expect(dragAndScale.visible_area.height).toBe(600)
  })

  it('centers and scales bounds inside the supplied viewport', () => {
    const dragAndScale = new DragAndScale(createCanvas(1000, 500))

    dragAndScale.fitToBounds([0, 0, 500, 250], {
      viewport: [200, 0, 600, 500]
    })

    expect(dragAndScale.scale).toBeCloseTo(0.9)
    expect((250 + dragAndScale.offset[0]) * dragAndScale.scale).toBeCloseTo(500)
    expect((125 + dragAndScale.offset[1]) * dragAndScale.scale).toBeCloseTo(250)
  })

  it('returns early for an empty supplied viewport', () => {
    const dragAndScale = new DragAndScale(createCanvas(1000, 500))
    dragAndScale.offset = [13, 29]
    dragAndScale.scale = 2

    dragAndScale.fitToBounds([0, 0, 500, 250], {
      viewport: [200, 0, 0, 500]
    })

    expect(dragAndScale.offset).toEqual([13, 29])
    expect(dragAndScale.scale).toBe(2)
  })
})
