import { describe, expect, it } from 'vitest'

import {
  applyViewport,
  measureViewport
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

  it('clamps DPR to minimum of 1', () => {
    const vp = measureViewport(800, 600, 0.5, 0)
    expect(vp.dpr).toBe(1)
    expect(vp.physicalWidth).toBe(800)
    expect(vp.physicalHeight).toBe(600)
  })

  it('clamps negative DPR to 1', () => {
    const vp = measureViewport(100, 100, -1, 0)
    expect(vp.dpr).toBe(1)
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
