import { describe, expect, it, vi } from 'vitest'

import {
  applyLogicalCanvasStyle,
  applyViewport,
  measureViewport,
  measureViewportFromElement
} from '@/renderer/core/canvas/canvasViewport'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement,
  setIntrinsicCanvasLayout
} from '@/utils/__tests__/canvasTestUtils'

function createTransformTrackingCanvas(cssSize?: {
  width: number
  height: number
}) {
  const transform = { x: 1, y: 1 }
  // `scale` multiplies the current transform; `setTransform` replaces it. The
  // difference is what the compounding and probe-reset cases below observe.
  const setTransform: CanvasRenderingContext2D['setTransform'] = vi.fn(
    (
      a?: number | DOMMatrix2DInit,
      _b?: number,
      _c?: number,
      d?: number
    ): void => {
      if (typeof a !== 'number' || typeof d !== 'number') return
      transform.x = a
      transform.y = d
    }
  )
  const ctx = createMockCanvasRenderingContext2D({
    scale: vi.fn((x: number, y: number) => {
      transform.x *= x
      transform.y *= y
    }),
    setTransform
  })
  const canvas = createTestCanvasElement({ ctx })
  for (const dimension of ['width', 'height'] as const) {
    let backingStore = canvas[dimension]
    Object.defineProperty(canvas, dimension, {
      configurable: true,
      get: () => backingStore,
      set: (value: number) => {
        backingStore = value
        transform.x = 1
        transform.y = 1
      }
    })
  }
  if (cssSize) {
    vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, 0, cssSize.width, cssSize.height)
    )
  }
  return { canvas, ctx, transform }
}

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
    expect(fgContext.setTransform).toHaveBeenCalledExactlyOnceWith(
      2,
      0,
      0,
      2,
      0,
      0
    )
    expect(bgContext.setTransform).toHaveBeenCalledExactlyOnceWith(
      2,
      0,
      0,
      2,
      0,
      0
    )
  })

  it('scales a shared foreground/background context only once', () => {
    const ctx = createMockCanvasRenderingContext2D()
    const canvas = createTestCanvasElement({ ctx })

    applyViewport(measureViewport(800, 600, 2), canvas, canvas)

    expect(ctx.setTransform).toHaveBeenCalledExactlyOnceWith(2, 0, 0, 2, 0, 0)
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

  it('keeps the DPR transform across a measurement probe, even when the backing size rounds back', () => {
    const cssSize = { width: 800.1, height: 600 }
    const { canvas, transform } = createTransformTrackingCanvas(cssSize)

    applyViewport(measureViewportFromElement(canvas, 2), canvas, canvas)
    expect(transform).toEqual({ x: 2, y: 2 })

    // The probe resets the context by reassigning the backing attributes, and
    // rounding back to the same physical size means no later write undoes it.
    cssSize.width = 800.2
    const reprobed = measureViewportFromElement(canvas, 2)
    expect([reprobed.physicalWidth, reprobed.physicalHeight]).toEqual([
      canvas.width,
      canvas.height
    ])
    expect(transform).toEqual({ x: 2, y: 2 })

    applyViewport(reprobed, canvas, canvas)

    expect(transform).toEqual({ x: 2, y: 2 })
  })

  it('does not compound the DPR scale when a new DPR lands on an unchanged backing store', () => {
    const { canvas, transform } = createTransformTrackingCanvas()

    applyViewport(measureViewport(800, 600, 2), canvas, canvas)
    expect(transform).toEqual({ x: 2, y: 2 })

    applyViewport(measureViewport(1600 / 3, 400, 3), canvas, canvas)

    expect(transform).toEqual({ x: 3, y: 3 })
  })

  it('re-scales after a size change at an unchanged DPR', () => {
    const { canvas, transform } = createTransformTrackingCanvas()

    applyViewport(measureViewport(800, 600, 2), canvas, canvas)
    expect(transform).toEqual({ x: 2, y: 2 })

    applyViewport(measureViewport(1000, 700, 2), canvas, canvas)

    expect(transform).toEqual({ x: 2, y: 2 })
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

    applyLogicalCanvasStyle(canvas, 0, 0)

    expect([canvas.style.width, canvas.style.height]).toEqual(['', ''])
  })

  it('leaves a class-sized canvas to its stylesheet', () => {
    const canvas = createTestCanvasElement({ cssSize: [800, 600] })

    applyLogicalCanvasStyle(canvas, 800, 600)

    expect([canvas.style.width, canvas.style.height]).toEqual(['', ''])
  })

  it('pins an unstyled canvas whose intrinsic size already matches the request', () => {
    const canvas = createTestCanvasElement()
    setIntrinsicCanvasLayout(canvas)

    applyLogicalCanvasStyle(canvas, 800, 600)

    expect([canvas.style.width, canvas.style.height]).toEqual([
      '800px',
      '600px'
    ])
  })

  it('reuses the stylesheet verdict instead of reprobing an unchanged canvas', () => {
    const canvas = createTestCanvasElement({ cssSize: [800, 600] })
    applyLogicalCanvasStyle(canvas, 800, 600)
    const backingStoreWrites = vi.spyOn(canvas, 'width', 'set')

    applyLogicalCanvasStyle(canvas, 800, 600)

    expect(backingStoreWrites).not.toHaveBeenCalled()
    expect([canvas.style.width, canvas.style.height]).toEqual(['', ''])
  })
})
