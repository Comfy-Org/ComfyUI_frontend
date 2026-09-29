import { describe, expect, it } from 'vitest'

import {
  applyViewport,
  measureViewport,
  measureViewportFromElement
} from '@/renderer/core/canvas/canvasViewport'

function mockCanvas(
  width = 0,
  height = 0
): HTMLCanvasElement & { scaleArgs: number[][] } {
  const scaleArgs: number[][] = []
  return {
    width,
    height,
    getContext: () => ({
      scale: (x: number, y: number) => scaleArgs.push([x, y])
    }),
    scaleArgs
  } as unknown as HTMLCanvasElement & { scaleArgs: number[][] }
}

describe('measureViewport', () => {
  it('computes physical dimensions from CSS dimensions and DPR', () => {
    const vp = measureViewport(800, 600, 2, 0)
    expect(vp.cssWidth).toBe(800)
    expect(vp.cssHeight).toBe(600)
    expect(vp.dpr).toBe(2)
    expect(vp.physicalWidth).toBe(1600)
    expect(vp.physicalHeight).toBe(1200)
  })

  it('preserves sub-1 DPR (e.g. chromium-0.5x test matrix)', () => {
    const vp = measureViewport(800, 600, 0.5, 0)
    expect(vp.dpr).toBe(0.5)
    expect(vp.physicalWidth).toBe(400)
    expect(vp.physicalHeight).toBe(300)
  })

  it('falls back to 1 for invalid (non-positive) DPR', () => {
    const vp = measureViewport(100, 100, -1, 0)
    expect(vp.dpr).toBe(1)
  })

  it('falls back to 1 for non-finite DPR', () => {
    expect(measureViewport(100, 100, Number.POSITIVE_INFINITY, 0).dpr).toBe(1)
    expect(measureViewport(100, 100, Number.NaN, 0).dpr).toBe(1)
  })

  it('increments generation from previous value', () => {
    const vp1 = measureViewport(800, 600, 1, 0)
    expect(vp1.generation).toBe(1)

    const vp2 = measureViewport(800, 600, 1, vp1.generation)
    expect(vp2.generation).toBe(2)
  })

  it('rounds physical dimensions', () => {
    const vp = measureViewport(801, 601, 1.5, 0)
    expect(vp.physicalWidth).toBe(Math.round(801 * 1.5))
    expect(vp.physicalHeight).toBe(Math.round(601 * 1.5))
  })

  it('returns a frozen object', () => {
    const vp = measureViewport(800, 600, 2, 0)
    expect(Object.isFrozen(vp)).toBe(true)
  })
})

describe('measureViewportFromElement', () => {
  it('measures before mutating a canvas without CSS dimensions', () => {
    const canvas = {
      width: 800,
      height: 600,
      getBoundingClientRect(this: { width: number; height: number }) {
        return { width: this.width, height: this.height }
      }
    } as HTMLCanvasElement

    const viewport = measureViewportFromElement(canvas, 2, 0)

    expect(viewport.cssWidth).toBe(800)
    expect(viewport.cssHeight).toBe(600)
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
  })

  it('does not multiply backing dimensions across repeated measurements', () => {
    const canvas = {
      width: 800,
      height: 600,
      getBoundingClientRect(this: { width: number; height: number }) {
        return { width: this.width, height: this.height }
      },
      getContext: () => ({ scale: vi.fn() })
    } as unknown as HTMLCanvasElement

    const first = measureViewportFromElement(canvas, 2, 0)
    applyViewport(first, canvas, canvas)
    const second = measureViewportFromElement(canvas, 2, first.generation)

    expect(second.cssWidth).toBe(800)
    expect(second.cssHeight).toBe(600)
    expect(second.physicalWidth).toBe(1600)
    expect(second.physicalHeight).toBe(1200)
  })

  it('measures CSS dimensions independently of backing dimensions', () => {
    const canvas = {
      width: 1600,
      height: 1200,
      getBoundingClientRect() {
        return { width: 800, height: 600 }
      }
    } as HTMLCanvasElement

    const viewport = measureViewportFromElement(canvas, 2, 0)

    expect(viewport.cssWidth).toBe(800)
    expect(viewport.cssHeight).toBe(600)
  })

  it('preserves a hidden canvas measurement', () => {
    const canvas = {
      width: 1600,
      height: 1200,
      getBoundingClientRect: () => ({ width: 0, height: 0 })
    } as HTMLCanvasElement

    const viewport = measureViewportFromElement(canvas, 2, 0)

    expect(viewport.cssWidth).toBe(0)
    expect(viewport.cssHeight).toBe(0)
  })
})

describe('applyViewport', () => {
  it('sets both canvases to physical dimensions', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const fg = mockCanvas()
    const bg = mockCanvas()

    applyViewport(vp, fg, bg)

    expect(fg.width).toBe(1600)
    expect(fg.height).toBe(1200)
    expect(bg.width).toBe(1600)
    expect(bg.height).toBe(1200)
  })

  it('scales both canvas contexts by DPR', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const fg = mockCanvas()
    const bg = mockCanvas()

    applyViewport(vp, fg, bg)

    expect(fg.scaleArgs).toEqual([[2, 2]])
    expect(bg.scaleArgs).toEqual([[2, 2]])
  })

  it('scales a shared foreground/background context only once', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const canvas = mockCanvas()

    applyViewport(vp, canvas, canvas)

    expect(canvas.scaleArgs).toEqual([[2, 2]])
  })

  it('produces identical dimensions on both canvases', () => {
    const vp = measureViewport(1920, 1080, 2.5, 0)
    const fg = mockCanvas(100, 100)
    const bg = mockCanvas(200, 300)

    applyViewport(vp, fg, bg)

    expect(fg.width).toBe(bg.width)
    expect(fg.height).toBe(bg.height)
  })

  it('handles DPR of 1 without scaling artifacts', () => {
    const vp = measureViewport(800, 600, 1, 0)
    const fg = mockCanvas()
    const bg = mockCanvas()

    applyViewport(vp, fg, bg)

    expect(fg.width).toBe(800)
    expect(fg.height).toBe(600)
    expect(fg.scaleArgs).toEqual([[1, 1]])
  })
})
