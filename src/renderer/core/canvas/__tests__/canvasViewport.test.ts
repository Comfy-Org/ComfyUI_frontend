import { describe, expect, it, vi } from 'vitest'

import {
  applyLogicalCanvasStyle,
  applyViewport,
  measureViewport,
  measureViewportFromElement
} from '@/renderer/core/canvas/canvasViewport'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/canvasTestUtils'

describe('measureViewport', () => {
  it('computes physical dimensions from CSS dimensions and DPR', () => {
    expect(measureViewport(800, 600, 2)).toEqual({
      cssWidth: 800,
      cssHeight: 600,
      dpr: 2,
      physicalWidth: 1600,
      physicalHeight: 1200
    })
  })

  it.for([
    { rawDpr: 0.5, dpr: 1 },
    { rawDpr: -1, dpr: 1 },
    { rawDpr: Number.POSITIVE_INFINITY, dpr: 1 },
    { rawDpr: Number.NaN, dpr: 1 },
    { rawDpr: 1.5, dpr: 1.5 }
  ])('normalizes a raw DPR of $rawDpr to $dpr', ({ rawDpr, dpr }) => {
    expect(measureViewport(800, 600, rawDpr).dpr).toBe(dpr)
  })

  it('rounds physical dimensions', () => {
    const viewport = measureViewport(801, 601, 1.5)

    expect([viewport.physicalWidth, viewport.physicalHeight]).toEqual([
      1202, 902
    ])
  })

  it('returns a frozen object', () => {
    expect(Object.isFrozen(measureViewport(800, 600, 2))).toBe(true)
  })
})

describe('measureViewportFromElement', () => {
  it.for([
    { name: 'a visible canvas', cssSize: [800, 600], expected: [800, 600] },
    { name: 'a hidden canvas', cssSize: [0, 0], expected: [0, 0] }
  ] as const)(
    'measures CSS dimensions independently of the backing store for $name',
    ({ cssSize, expected }) => {
      const canvas = createTestCanvasElement({
        width: 1600,
        height: 1200,
        cssSize: [...cssSize]
      })

      const viewport = measureViewportFromElement(canvas, 2)

      expect([viewport.cssWidth, viewport.cssHeight]).toEqual(expected)
    }
  )

  it('does not multiply an intrinsically sized canvas across measurements', () => {
    const canvas = createTestCanvasElement()
    vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, 0, canvas.width, canvas.height)
    )

    applyViewport(measureViewportFromElement(canvas, 2), canvas, canvas)
    const second = measureViewportFromElement(canvas, 2)

    expect(second).toMatchObject({
      cssWidth: 800,
      cssHeight: 600,
      physicalWidth: 1600,
      physicalHeight: 1200
    })
  })
})

describe('applyViewport', () => {
  it('sizes and scales both canvases to the physical dimensions', () => {
    const fgContext = createMockCanvasRenderingContext2D()
    const bgContext = createMockCanvasRenderingContext2D()
    const fg = createTestCanvasElement({ ctx: fgContext })
    const bg = createTestCanvasElement({ ctx: bgContext })

    applyViewport(measureViewport(800, 600, 2), fg, bg)

    expect([fg.width, fg.height, bg.width, bg.height]).toEqual([
      1600, 1200, 1600, 1200
    ])
    expect(fgContext.scale).toHaveBeenCalledExactlyOnceWith(2, 2)
    expect(bgContext.scale).toHaveBeenCalledExactlyOnceWith(2, 2)
  })

  it('scales a shared foreground/background context only once', () => {
    const ctx = createMockCanvasRenderingContext2D()
    const canvas = createTestCanvasElement({ ctx })

    applyViewport(measureViewport(800, 600, 2), canvas, canvas)

    expect(ctx.scale).toHaveBeenCalledExactlyOnceWith(2, 2)
  })

  it('hands the applied DPR and CSS dimensions to the consumer', () => {
    const consumer = { dpr: 1, ds: { setViewportSize: vi.fn() } }

    applyViewport(
      measureViewport(800, 600, 2),
      createTestCanvasElement(),
      createTestCanvasElement(),
      consumer
    )

    expect(consumer.dpr).toBe(2)
    expect(consumer.ds.setViewportSize).toHaveBeenCalledWith(800, 600)
  })

  it('restores the DPR transform a measurement probe reset, even when the backing size rounds back', () => {
    // A CSS-sized canvas whose layout does not depend on its backing store,
    // as `absolute inset-0 size-full` makes the real graph canvas.
    const ctx = createMockCanvasRenderingContext2D()
    const canvas = createTestCanvasElement({ ctx })
    const cssSize = { width: 800.1, height: 600 }
    vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, 0, cssSize.width, cssSize.height)
    )

    applyViewport(measureViewportFromElement(canvas, 2), canvas, canvas)
    expect(ctx.scale).toHaveBeenCalledExactlyOnceWith(2, 2)

    // A sub-pixel layout change: enough to re-probe, not enough to change the
    // rounded backing-store size. The probe assigns `width`/`height`, which
    // resets the 2D context to the identity transform.
    cssSize.width = 800.2
    const reprobed = measureViewportFromElement(canvas, 2)
    expect([reprobed.physicalWidth, reprobed.physicalHeight]).toEqual([
      canvas.width,
      canvas.height
    ])

    applyViewport(reprobed, canvas, canvas)

    expect(ctx.scale).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('does not reset backing stores that already match', () => {
    const viewport = measureViewport(800, 600, 2)
    const fg = createTestCanvasElement()
    const bg = createTestCanvasElement()
    applyViewport(viewport, fg, bg)
    const sizeWrites = [
      vi.spyOn(fg, 'width', 'set'),
      vi.spyOn(fg, 'height', 'set'),
      vi.spyOn(bg, 'width', 'set'),
      vi.spyOn(bg, 'height', 'set')
    ]

    applyViewport(viewport, fg, bg)

    expect(sizeWrites.map((write) => write.mock.calls.length)).toEqual([
      0, 0, 0, 0
    ])
  })
})

describe('applyLogicalCanvasStyle', () => {
  it('follows the parent while the canvas style is its own', () => {
    const canvas = createTestCanvasElement()

    applyLogicalCanvasStyle(canvas, 800, 600)
    applyLogicalCanvasStyle(canvas, 1000, 700)

    expect([canvas.style.width, canvas.style.height]).toEqual([
      '1000px',
      '700px'
    ])
  })

  it('keeps CSS dimensions supplied by the caller', () => {
    const canvas = createTestCanvasElement()
    canvas.style.width = '75%'
    canvas.style.height = '50vh'

    applyLogicalCanvasStyle(canvas, 800, 600)

    expect([canvas.style.width, canvas.style.height]).toEqual(['75%', '50vh'])
  })

  it('never pins a degenerate measurement', () => {
    const canvas = createTestCanvasElement()

    // A parent measured before layout settles reports 0x0. Pinning that would
    // hide the canvas until something else resized it.
    applyLogicalCanvasStyle(canvas, 0, 0)

    expect([canvas.style.width, canvas.style.height]).toEqual(['', ''])
  })

  it('leaves a class-sized canvas to its stylesheet', () => {
    // No inline style, but CSS already lays it out at the target size — as a
    // `size-full` canvas inside an 800x600 parent does.
    const canvas = createTestCanvasElement({ cssSize: [800, 600] })

    applyLogicalCanvasStyle(canvas, 800, 600)

    expect([canvas.style.width, canvas.style.height]).toEqual(['', ''])
  })
})
