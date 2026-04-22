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
  it('expands bounds on first call', () => {
    const rect = updateDirtyRect(resetDirtyRect(), 50, 50, 10)
    expect(rect.minX).toBeLessThan(50)
    expect(rect.maxX).toBeGreaterThan(50)
  })

  it('never shrinks existing bounds on subsequent calls', () => {
    let rect = updateDirtyRect(resetDirtyRect(), 50, 50, 10)
    rect = updateDirtyRect(rect, 10, 10, 2)
    expect(rect.minX).toBeLessThanOrEqual(10 - 2)
    expect(rect.maxX).toBeGreaterThanOrEqual(50 + 10)
  })

  it('includes padding in the expanded bounds', () => {
    const rect = updateDirtyRect(resetDirtyRect(), 50, 50, 10)
    expect(rect.minX).toBe(50 - 10 - 2)
    expect(rect.maxX).toBe(50 + 10 + 2)
  })
})

describe('resetDirtyRect', () => {
  it('returns infinite bounds so first updateDirtyRect always expands', () => {
    const rect = resetDirtyRect()
    expect(rect.minX).toBe(Infinity)
    expect(rect.minY).toBe(Infinity)
    expect(rect.maxX).toBe(-Infinity)
    expect(rect.maxY).toBe(-Infinity)
  })
})

describe('drawRgbShape', () => {
  it('sets fillStyle and calls arc for Arc brush at hardness=1', () => {
    const ctx = makeMockCtx()
    drawRgbShape(ctx, point, BrushShape.Arc, 10, 1, 0.8, '#ff0000')
    expect(ctx.arc).toHaveBeenCalledWith(10, 10, 10, 0, Math.PI * 2, false)
  })

  it('sets fillStyle and calls rect for Rect brush at hardness=1', () => {
    const ctx = makeMockCtx()
    drawRgbShape(ctx, point, BrushShape.Rect, 10, 1, 0.8, '#ff0000')
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 20, 20)
  })

  it('uses radial gradient for Arc brush at hardness < 1', () => {
    const ctx = makeMockCtx()
    drawRgbShape(ctx, point, BrushShape.Arc, 10, 0.5, 0.8, '#ff0000')
    expect(ctx.createRadialGradient).toHaveBeenCalled()
  })

  describe('Rect brush with soft hardness (uses brush texture cache)', () => {
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

    it('calls drawImage with the cached texture', () => {
      const ctx = makeMockCtx()
      drawRgbShape(ctx, point, BrushShape.Rect, 10, 0.5, 0.8, '#ff0000')
      expect(ctx.drawImage).toHaveBeenCalled()
    })
  })
})

describe('drawMaskShape', () => {
  const maskColor = { r: 255, g: 0, b: 0 }

  it('calls arc when not erasing, Arc brush, hardness=1', () => {
    const ctx = makeMockCtx()
    drawMaskShape(ctx, point, BrushShape.Arc, 10, 1, 0.8, false, maskColor)
    expect(ctx.arc).toHaveBeenCalledWith(10, 10, 10, 0, Math.PI * 2, false)
  })

  it('sets white fillStyle when erasing at hardness=1', () => {
    const ctx = makeMockCtx()
    drawMaskShape(ctx, point, BrushShape.Arc, 10, 1, 0.8, true, maskColor)
    expect(ctx.fillStyle).toContain('255, 255, 255')
  })

  it('uses radial gradient when hardness < 1 and not erasing', () => {
    const ctx = makeMockCtx()
    drawMaskShape(ctx, point, BrushShape.Arc, 10, 0.5, 0.8, false, maskColor)
    expect(ctx.createRadialGradient).toHaveBeenCalled()
  })

  it('uses radial gradient when hardness < 1 and erasing', () => {
    const ctx = makeMockCtx()
    drawMaskShape(ctx, point, BrushShape.Arc, 10, 0.5, 0.8, true, maskColor)
    expect(ctx.createRadialGradient).toHaveBeenCalled()
  })

  describe('Rect brush with soft hardness (uses brush texture cache)', () => {
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

    it('calls drawImage when not erasing', () => {
      const ctx = makeMockCtx()
      drawMaskShape(ctx, point, BrushShape.Rect, 10, 0.5, 0.8, false, maskColor)
      expect(ctx.drawImage).toHaveBeenCalled()
    })

    it('calls drawImage when erasing', () => {
      const ctx = makeMockCtx()
      drawMaskShape(ctx, point, BrushShape.Rect, 10, 0.5, 0.8, true, maskColor)
      expect(ctx.drawImage).toHaveBeenCalled()
    })
  })
})
