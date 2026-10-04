import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  createTestCanvasElement,
  setIntrinsicCanvasLayout
} from '@/utils/__tests__/canvasTestUtils'

describe('LGraphCanvas.resize', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 2)
  })

  function createParentSizedCanvas() {
    const parentSize = { width: 800, height: 600 }
    const parent = document.createElement('div')
    Object.defineProperties(parent, {
      offsetWidth: { get: () => parentSize.width },
      offsetHeight: { get: () => parentSize.height }
    })
    const element = createTestCanvasElement()
    parent.append(element)
    const canvas = new LGraphCanvas(element, new LGraph(), {
      skip_render: true,
      skip_events: true
    })
    return { canvas, parentSize }
  }

  it('follows parent growth with logical CSS size and DPR-scaled backing size', () => {
    const { canvas, parentSize } = createParentSizedCanvas()
    canvas.resize()

    parentSize.width = 1000
    parentSize.height = 700
    canvas.resize()

    const { style, width, height } = canvas.canvas
    expect([style.width, style.height, width, height]).toEqual([
      '1000px',
      '700px',
      2000,
      1400
    ])
  })

  it('keeps an unstyled canvas whose intrinsic size already matches its parent at its logical size', () => {
    const { canvas } = createParentSizedCanvas()
    setIntrinsicCanvasLayout(canvas.canvas)
    canvas.canvas.width = 800
    canvas.canvas.height = 600

    canvas.resize()

    const rect = canvas.canvas.getBoundingClientRect()
    expect([
      rect.width,
      rect.height,
      canvas.canvas.width,
      canvas.canvas.height
    ]).toEqual([800, 600, 1600, 1200])
  })

  it('sizes the backing store without overriding caller CSS dimensions', () => {
    const { canvas } = createParentSizedCanvas()
    canvas.canvas.style.width = '75%'
    canvas.canvas.style.height = '50vh'

    canvas.resize()

    const { style, width, height } = canvas.canvas
    expect([style.width, style.height, width, height]).toEqual([
      '75%',
      '50vh',
      1600,
      1200
    ])
  })

  it('keeps explicit dimensions in CSS pixels rather than letting the backing store size the layout', () => {
    const { canvas } = createParentSizedCanvas()

    canvas.resize(800, 600)

    const { style, width, height } = canvas.canvas
    expect([style.width, style.height, width, height]).toEqual([
      '800px',
      '600px',
      1600,
      1200
    ])
  })

  it('releases its explicit-size pin when returning to parent sizing', () => {
    const { canvas, parentSize } = createParentSizedCanvas()
    canvas.resize(640, 480)
    parentSize.width = 1000
    parentSize.height = 700

    canvas.resize()

    expect([
      canvas.canvas.style.width,
      canvas.canvas.style.height,
      canvas.canvas.width,
      canvas.canvas.height
    ]).toEqual(['1000px', '700px', 2000, 1400])
  })

  it('repaints when the sizing probe discarded the bitmap but nothing resized', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const { canvas } = createParentSizedCanvas()
    // A stylesheet-sized canvas at DPR 1, so its backing store already matches
    // its layout box: the ambiguous case that has to be probed, with no size
    // change afterwards to force a redraw on its own.
    vi.spyOn(canvas.canvas, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 800, 600)
    )
    canvas.canvas.width = 800
    canvas.canvas.height = 600
    canvas.dirty_canvas = false
    canvas.dirty_bgcanvas = false

    canvas.resize()

    expect([canvas.dirty_canvas, canvas.dirty_bgcanvas]).toEqual([true, true])
    expect([canvas.canvas.style.width, canvas.canvas.style.height]).toEqual([
      '',
      ''
    ])
  })

  it('recomputes the LOD threshold when a resize changes DPR', () => {
    const { canvas } = createParentSizedCanvas()
    vi.stubGlobal('devicePixelRatio', 1)
    canvas.resize(800, 600)
    canvas.ds.scale = 0.4
    canvas.ds.computeVisibleArea(undefined)
    expect(canvas.low_quality).toBe(true)

    vi.stubGlobal('devicePixelRatio', 4)
    canvas.resize(800, 600)

    expect(canvas.low_quality).toBe(false)
  })
})
