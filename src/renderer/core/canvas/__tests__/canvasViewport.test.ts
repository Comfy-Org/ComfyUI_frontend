import { describe, expect, it, vi } from 'vitest'

import {
  applyParentSizedCanvasStyle,
  applyViewport,
  measureViewport,
  measureViewportFromElement
} from '@/renderer/core/canvas/canvasViewport'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/litegraphTestUtils'

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

describe('applyParentSizedCanvasStyle', () => {
  it('follows the parent while the canvas style is its own', () => {
    const canvas = createTestCanvasElement()

    applyParentSizedCanvasStyle(canvas, 800, 600)
    applyParentSizedCanvasStyle(canvas, 1000, 700)

    expect([canvas.style.width, canvas.style.height]).toEqual([
      '1000px',
      '700px'
    ])
  })

  it('keeps CSS dimensions supplied by the caller', () => {
    const canvas = createTestCanvasElement()
    canvas.style.width = '75%'
    canvas.style.height = '50vh'

    applyParentSizedCanvasStyle(canvas, 800, 600)

    expect([canvas.style.width, canvas.style.height]).toEqual(['75%', '50vh'])
  })
})
