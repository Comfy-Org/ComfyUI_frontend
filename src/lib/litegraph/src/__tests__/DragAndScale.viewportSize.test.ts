import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DragAndScale,
  LGraph,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

describe('DragAndScale viewport size cache', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 1)
  })

  it('does not cache an unusable viewport size', () => {
    // A hidden or not-yet-laid-out canvas measures 0x0. Caching that makes
    // every later fit a silent no-op, because fitting rejects an empty
    // rectangle — so fall back to measuring the element instead.
    const ds = new DragAndScale(
      createTestCanvasElement({ width: 800, height: 600 })
    )

    ds.setViewportSize(0, 0)

    expect(ds.getViewportSize()).toEqual([800, 600])
  })

  it('hands out a copy so a caller cannot poison the cache', () => {
    const ds = new DragAndScale(createTestCanvasElement())
    ds.setViewportSize(800, 600)

    const mutated = ds.getViewportSize()
    mutated[0] = 0
    mutated[1] = 0

    expect(ds.getViewportSize()).toEqual([800, 600])
  })

  it('forgets the previous element’s viewport when the canvas is replaced', () => {
    const element = createTestCanvasElement({ width: 800, height: 600 })
    const canvas = new LGraphCanvas(element, new LGraph(), {
      skip_render: true,
      skip_events: true
    })
    canvas.ds.setViewportSize(800, 600)

    canvas.setCanvas(createTestCanvasElement({ width: 400, height: 300 }), true)

    expect(canvas.ds.getViewportSize()).toEqual([400, 300])
  })
})
