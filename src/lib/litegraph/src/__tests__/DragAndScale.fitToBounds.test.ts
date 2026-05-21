import { beforeEach, describe, expect, it } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/litegraph'

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
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
})
