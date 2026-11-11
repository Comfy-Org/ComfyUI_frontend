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

describe('DragAndScale anchored zoom', () => {
  it.for([
    { requested: 8, expected: 4 },
    { requested: 0.01, expected: 0.25 },
    { requested: 1.005, expected: 1 },
    { requested: 1.02, expected: 1.02 }
  ])(
    'clamps or snaps $requested to $expected without moving the anchor',
    ({ requested, expected }) => {
      const element = createTestCanvasElement({ cssSize: [800, 600] })
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(13, 29, 800, 600)
      )
      const ds = new DragAndScale(element)
      ds.min_scale = 0.25
      ds.max_scale = 4
      ds.scale = 2
      ds.offset = [17, -9]

      ds.changeScale(requested, [313, 229])

      expect(ds.scale).toBe(expected)
      const anchoredPoint = ds.convertCanvasToOffset([300, 200])
      expect(anchoredPoint[0]).toBeCloseTo(133, 5)
      expect(anchoredPoint[1]).toBeCloseTo(109, 5)
      ds.changeScale(2, [313, 229])
      expect(ds.offset[0]).toBeCloseTo(17, 5)
      expect(ds.offset[1]).toBeCloseTo(-9, 5)
    }
  )
})
