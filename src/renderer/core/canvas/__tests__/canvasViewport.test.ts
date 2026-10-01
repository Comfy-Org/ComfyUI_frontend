import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import {
  applyViewport,
  measureViewport,
  measureViewportFromElement
} from '@/renderer/core/canvas/canvasViewport'

function mockCanvas(
  width = 0,
  height = 0
): { canvas: HTMLCanvasElement; scaleArgs: number[][] } {
  const scaleArgs: number[][] = []
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  vi.spyOn(canvas, 'getContext').mockReturnValue(
    fromPartial<CanvasRenderingContext2D & GPUCanvasContext>({
      scale: (x: number, y: number) => scaleArgs.push([x, y])
    })
  )
  return { canvas, scaleArgs }
}

function observedCanvas(width: number, height: number) {
  const writes = { width: 0, height: 0 }
  let currentWidth = width
  let currentHeight = height
  const canvas = document.createElement('canvas')
  Object.defineProperties(canvas, {
    width: {
      configurable: true,
      get: () => currentWidth,
      set: (value: number) => {
        writes.width++
        currentWidth = value
      }
    },
    height: {
      configurable: true,
      get: () => currentHeight,
      set: (value: number) => {
        writes.height++
        currentHeight = value
      }
    }
  })
  vi.spyOn(canvas, 'getContext').mockReturnValue(
    fromPartial<CanvasRenderingContext2D & GPUCanvasContext>({ scale: vi.fn() })
  )
  return { canvas, writes }
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

  it('clamps sub-1 DPR to one backing pixel per CSS pixel', () => {
    const vp = measureViewport(800, 600, 0.5, 0)
    expect(vp.dpr).toBe(1)
    expect(vp.physicalWidth).toBe(800)
    expect(vp.physicalHeight).toBe(600)
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
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() =>
      fromPartial({ width: canvas.width, height: canvas.height })
    )

    const viewport = measureViewportFromElement(canvas, 2, 0)

    expect(viewport.cssWidth).toBe(800)
    expect(viewport.cssHeight).toBe(600)
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
  })

  it('does not multiply backing dimensions across repeated measurements', () => {
    const { canvas } = mockCanvas(800, 600)
    vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() =>
      fromPartial({ width: canvas.width, height: canvas.height })
    )

    const first = measureViewportFromElement(canvas, 2, 0)
    applyViewport(first, canvas, canvas)
    const second = measureViewportFromElement(canvas, 2, first.generation)

    expect(second.cssWidth).toBe(800)
    expect(second.cssHeight).toBe(600)
    expect(second.physicalWidth).toBe(1600)
    expect(second.physicalHeight).toBe(1200)
  })

  it('measures CSS dimensions independently of backing dimensions', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 1200
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
      fromPartial({ width: 800, height: 600 })
    )

    const viewport = measureViewportFromElement(canvas, 2, 0)

    expect(viewport.cssWidth).toBe(800)
    expect(viewport.cssHeight).toBe(600)
  })

  it('preserves a hidden canvas measurement', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 1200
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
      fromPartial({ width: 0, height: 0 })
    )

    const viewport = measureViewportFromElement(canvas, 2, 0)

    expect(viewport.cssWidth).toBe(0)
    expect(viewport.cssHeight).toBe(0)
  })
})

describe('applyViewport', () => {
  it('sets both canvases to physical dimensions', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const { canvas: fg } = mockCanvas()
    const { canvas: bg } = mockCanvas()

    applyViewport(vp, fg, bg)

    expect(fg.width).toBe(1600)
    expect(fg.height).toBe(1200)
    expect(bg.width).toBe(1600)
    expect(bg.height).toBe(1200)
  })

  it('hands CSS dimensions to the viewport consumer', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const consumer = { setViewportSize: vi.fn() }

    applyViewport(vp, mockCanvas().canvas, mockCanvas().canvas, consumer)

    expect(consumer.setViewportSize).toHaveBeenCalledWith(800, 600)
  })

  it('scales both canvas contexts by DPR', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const fg = mockCanvas()
    const bg = mockCanvas()

    applyViewport(vp, fg.canvas, bg.canvas)

    expect(fg.scaleArgs).toEqual([[2, 2]])
    expect(bg.scaleArgs).toEqual([[2, 2]])
  })

  it('scales a shared foreground/background context only once', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const { canvas, scaleArgs } = mockCanvas()

    applyViewport(vp, canvas, canvas)

    expect(scaleArgs).toEqual([[2, 2]])
  })

  it('produces identical dimensions on both canvases', () => {
    const vp = measureViewport(1920, 1080, 2.5, 0)
    const { canvas: fg } = mockCanvas(100, 100)
    const { canvas: bg } = mockCanvas(200, 300)

    applyViewport(vp, fg, bg)

    expect(fg.width).toBe(bg.width)
    expect(fg.height).toBe(bg.height)
  })

  it('handles DPR of 1 without scaling artifacts', () => {
    const vp = measureViewport(800, 600, 1, 0)
    const fg = mockCanvas()
    const bg = mockCanvas()

    applyViewport(vp, fg.canvas, bg.canvas)

    expect(fg.canvas.width).toBe(800)
    expect(fg.canvas.height).toBe(600)
    expect(fg.scaleArgs).toEqual([[1, 1]])
  })

  it('does not reset matching canvas backing stores', () => {
    const vp = measureViewport(800, 600, 2, 0)
    const fg = observedCanvas(1600, 1200)
    const bg = observedCanvas(1600, 1200)

    applyViewport(vp, fg.canvas, bg.canvas)
    fg.writes.width = 0
    fg.writes.height = 0
    bg.writes.width = 0
    bg.writes.height = 0
    applyViewport(vp, fg.canvas, bg.canvas)

    expect(fg.writes).toEqual({ width: 0, height: 0 })
    expect(bg.writes).toEqual({ width: 0, height: 0 })
  })
})
