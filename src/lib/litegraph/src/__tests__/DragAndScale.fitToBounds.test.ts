import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { DragAndScale } from '@/lib/litegraph/src/litegraph'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

describe('DragAndScale.fitToBounds', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 1)
  })

  it.for<{ name: string; size: [number, number]; viewport?: ReadOnlyRect }>([
    { name: 'the canvas has no width', size: [0, 400] },
    { name: 'the canvas has no height', size: [400, 0] },
    {
      name: 'the supplied viewport is empty',
      size: [1000, 500],
      viewport: [200, 0, 0, 500]
    }
  ])(
    'leaves the camera unchanged when $name',
    ({ size: [width, height], viewport }) => {
      const dragAndScale = new DragAndScale(
        createTestCanvasElement({ width, height })
      )
      dragAndScale.offset = [13, 29]
      dragAndScale.scale = 2

      dragAndScale.fitToBounds([0, 0, 500, 500], { viewport })

      expect(dragAndScale.state).toEqual({ offset: [13, 29], scale: 2 })
    }
  )

  it('uses fallback 1920x1080 when canvas is 300x150', () => {
    const dragAndScale = new DragAndScale(
      createTestCanvasElement({ width: 300, height: 150 })
    )

    dragAndScale.fitToBounds([0, 0, 600, 600])

    expect(dragAndScale.scale).toBeCloseTo(1.35)
  })

  it('centers and scales bounds in the full canvas', () => {
    const dragAndScale = new DragAndScale(
      createTestCanvasElement({ width: 1000, height: 500 })
    )

    dragAndScale.fitToBounds([0, 0, 500, 250])

    expect(dragAndScale.scale).toBeCloseTo(1.25)
    expect(dragAndScale.offset[0]).toBeCloseTo(150)
    expect(dragAndScale.offset[1]).toBeCloseTo(75)
  })

  it('centers and scales bounds inside the supplied viewport', () => {
    const dragAndScale = new DragAndScale(
      createTestCanvasElement({ width: 1000, height: 500 })
    )

    dragAndScale.fitToBounds([0, 0, 500, 250], {
      viewport: [200, 0, 600, 500]
    })

    expect(dragAndScale.scale).toBeCloseTo(0.9)
    expect((250 + dragAndScale.offset[0]) * dragAndScale.scale).toBeCloseTo(500)
    expect((125 + dragAndScale.offset[1]) * dragAndScale.scale).toBeCloseTo(250)
  })

  it('does not fit below the minimum scale in a narrow viewport', () => {
    const dragAndScale = new DragAndScale(
      createTestCanvasElement({ width: 1000, height: 500 })
    )

    dragAndScale.fitToBounds([0, 0, 1000, 500], {
      viewport: [0, 0, 10, 500]
    })

    expect(dragAndScale.scale).toBe(dragAndScale.min_scale)
  })
})

describe('DragAndScale.computeVisibleArea', () => {
  it('refreshes a hidden cached viewport from visible layout', () => {
    const canvas = createTestCanvasElement({
      width: 1600,
      height: 1200,
      cssSize: [800, 600]
    })
    const dragAndScale = new DragAndScale(canvas)
    dragAndScale.setViewportSize(0, 0)

    expect(dragAndScale.getViewportSize()).toEqual([800, 600])
  })

  it('does not expose its cached viewport tuple by reference', () => {
    const dragAndScale = new DragAndScale(
      createTestCanvasElement({ width: 1600, height: 1200 })
    )
    dragAndScale.setViewportSize(800, 600)

    dragAndScale.getViewportSize()[0] = 1

    expect(dragAndScale.getViewportSize()).toEqual([800, 600])
  })

  it('uses the applied viewport size without reading layout', () => {
    const canvas = createTestCanvasElement({ width: 1600, height: 1200 })
    const rectSpy = vi.spyOn(canvas, 'getBoundingClientRect')
    const dragAndScale = new DragAndScale(canvas)
    dragAndScale.setViewportSize(800, 600)

    dragAndScale.computeVisibleArea(undefined)

    expect(rectSpy).not.toHaveBeenCalled()
    expect([
      dragAndScale.visible_area.width,
      dragAndScale.visible_area.height
    ]).toEqual([800, 600])
  })

  it.for<{
    name: string
    cssSize: [number, number]
    expected: [number, number]
  }>([
    {
      name: 'the CSS size when layout reports one',
      cssSize: [800, 500],
      expected: [800, 500]
    },
    {
      name: 'the backing size at DPR 1 when layout reports none',
      cssSize: [0, 0],
      expected: [400, 250]
    }
  ])('falls back to $name at a sub-1 browser DPR', ({ cssSize, expected }) => {
    vi.stubGlobal('devicePixelRatio', 0.5)
    const dragAndScale = new DragAndScale(
      createTestCanvasElement({ width: 400, height: 250, cssSize })
    )

    dragAndScale.computeVisibleArea(undefined)

    expect([
      dragAndScale.visible_area.width,
      dragAndScale.visible_area.height
    ]).toEqual(expected)
  })
})
