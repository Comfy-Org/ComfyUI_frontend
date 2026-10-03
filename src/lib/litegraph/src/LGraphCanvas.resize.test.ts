import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

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

  it('applies explicit dimensions as CSS pixels and backing-store pixels', () => {
    const { canvas } = createParentSizedCanvas()

    canvas.resize(640, 480)

    const { style, width, height } = canvas.canvas
    expect([style.width, style.height, width, height]).toEqual([
      '640px',
      '480px',
      1280,
      960
    ])
  })
})
