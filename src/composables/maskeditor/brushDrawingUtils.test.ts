import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BrushShape } from '@/extensions/core/maskeditor/types'
import type { Point } from '@/extensions/core/maskeditor/types'

import {
  drawMaskShape,
  drawRgbShape,
  premultiplyData,
  resetDirtyRect,
  updateDirtyRect
} from './brushDrawingUtils'

function makeMockCtx() {
  const gradient = { addColorStop: vi.fn() }
  return {
    beginPath: vi.fn(),
    fill: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    fillStyle: '',
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => gradient)
  } as unknown as CanvasRenderingContext2D
}

function makeMockCanvas() {
  const imageData = { data: new Uint8ClampedArray(40 * 40 * 4) }
  const ctx2d = {
    createImageData: vi.fn(() => imageData),
    putImageData: vi.fn()
  }
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx2d)
  } as unknown as HTMLCanvasElement
}

const point: Point = { x: 10, y: 10 }

describe('premultiplyData', () => {
  it('leaves RGB unchanged when alpha=255', () => {
    const data = new Uint8ClampedArray([100, 150, 200, 255])
    premultiplyData(data)
    expect(data[0]).toBe(100)
    expect(data[1]).toBe(150)
    expect(data[2]).toBe(200)
  })

  it('halves RGB values when alpha=128', () => {
    const data = new Uint8ClampedArray([200, 200, 200, 128])
    premultiplyData(data)
    expect(data[0]).toBeCloseTo(100, 0)
  })

  it('zeroes RGB when alpha=0', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 0])
    premultiplyData(data)
    expect(data[0]).toBe(0)
    expect(data[1]).toBe(0)
    expect(data[2]).toBe(0)
  })
})

describe('updateDirtyRect', () => {
  it('includes padding around the point', () => {
    const rect = updateDirtyRect(resetDirtyRect(), 50, 50, 10)
    expect(rect.minX).toBe(50 - 10 - 2)
    expect(rect.maxX).toBe(50 + 10 + 2)
  })

  it('never shrinks existing bounds on subsequent calls', () => {
    let rect = updateDirtyRect(resetDirtyRect(), 50, 50, 10)
    rect = updateDirtyRect(rect, 10, 10, 2)
    expect(rect.minX).toBeLessThanOrEqual(10 - 2)
    expect(rect.maxX).toBeGreaterThanOrEqual(50 + 10)
  })
})

describe('drawRgbShape', () => {
  it('draws arc at the correct center and radius for Arc brush at hardness=1', () => {
    const ctx = makeMockCtx()
    drawRgbShape(ctx, point, BrushShape.Arc, 10, 1, 0.8, '#ff0000')
    expect(ctx.arc).toHaveBeenCalledWith(10, 10, 10, 0, Math.PI * 2, false)
  })

  it('draws rect at the correct position for Rect brush at hardness=1', () => {
    const ctx = makeMockCtx()
    drawRgbShape(ctx, point, BrushShape.Rect, 10, 1, 0.8, '#ff0000')
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 20, 20)
  })

  it('creates radial gradient centered on the point for Arc brush at hardness < 1', () => {
    const ctx = makeMockCtx()
    drawRgbShape(ctx, point, BrushShape.Arc, 10, 0.5, 0.8, '#ff0000')
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(10, 10, 0, 10, 10, 10)
  })

  describe('Rect brush with soft hardness', () => {
    const originalCreateElement = document.createElement.bind(document)

    beforeEach(() => {
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return makeMockCanvas()
        return originalCreateElement(tag)
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('draws the cached brush texture at the correct offset', () => {
      const ctx = makeMockCtx()
      drawRgbShape(ctx, point, BrushShape.Rect, 10, 0.5, 0.8, '#ff0000')
      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0)
    })
  })
})

describe('drawMaskShape', () => {
  const maskColor = { r: 255, g: 0, b: 0 }

  it('draws arc at the correct center and radius when not erasing, hardness=1', () => {
    const ctx = makeMockCtx()
    drawMaskShape(ctx, point, BrushShape.Arc, 10, 1, 0.8, false, maskColor)
    expect(ctx.arc).toHaveBeenCalledWith(10, 10, 10, 0, Math.PI * 2, false)
  })

  it('uses white fill color when erasing at hardness=1', () => {
    const ctx = makeMockCtx()
    drawMaskShape(ctx, point, BrushShape.Arc, 10, 1, 0.8, true, maskColor)
    expect(ctx.fillStyle).toContain('255, 255, 255')
  })

  it('creates radial gradient centered on the point when hardness < 1', () => {
    const ctx = makeMockCtx()
    drawMaskShape(ctx, point, BrushShape.Arc, 10, 0.5, 0.8, false, maskColor)
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(10, 10, 0, 10, 10, 10)
  })

  describe('Rect brush with soft hardness', () => {
    const originalCreateElement = document.createElement.bind(document)

    beforeEach(() => {
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return makeMockCanvas()
        return originalCreateElement(tag)
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('draws the cached brush texture at the correct offset when not erasing', () => {
      const ctx = makeMockCtx()
      drawMaskShape(ctx, point, BrushShape.Rect, 10, 0.5, 0.8, false, maskColor)
      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0)
    })

    it('draws the cached brush texture at the correct offset when erasing', () => {
      const ctx = makeMockCtx()
      drawMaskShape(ctx, point, BrushShape.Rect, 10, 0.5, 0.8, true, maskColor)
      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0)
    })
  })
})
