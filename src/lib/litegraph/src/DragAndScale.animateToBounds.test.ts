import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

type Bounds = [number, number, number, number]

const START_TIME = 1000

function createDragAndScale() {
  return new DragAndScale(createTestCanvasElement({ width: 1600, height: 900 }))
}

function settle(ds: DragAndScale) {
  ds.advanceAnimation(START_TIME + 10_000)
}

const noRedraw = () => {}

function cameraOf(ds: DragAndScale) {
  return { offset: [...ds.offset], scale: ds.scale }
}

function screenCenterX(ds: DragAndScale, bounds: Bounds) {
  return (bounds[0] + bounds[2] * 0.5 + ds.offset[0]) * ds.scale
}

function screenCenterY(ds: DragAndScale, bounds: Bounds) {
  return (bounds[1] + bounds[3] * 0.5 + ds.offset[1]) * ds.scale
}

describe('DragAndScale.animateToBounds', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 1)
    vi.spyOn(performance, 'now').mockReturnValue(START_TIME)
  })

  it('centers bounds on the full canvas by default', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, noRedraw, { zoom: 0 })
    settle(ds)

    expect(screenCenterX(ds, bounds)).toBeCloseTo(800)
  })

  it('centers and fits bounds within a narrower viewport', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, noRedraw, {
      zoom: 0.75,
      viewport: [0, 0, 1100, 900]
    })
    settle(ds)

    expect(screenCenterX(ds, bounds)).toBeCloseTo(550)
    expect(ds.scale).toBeCloseTo(2.25)
  })

  it('centers on an offset, width-constrained viewport', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, noRedraw, {
      zoom: 0.75,
      viewport: [400, 0, 600, 900]
    })
    settle(ds)

    expect(screenCenterX(ds, bounds)).toBeCloseTo(700)
    expect(ds.scale).toBeCloseTo(1.5)
  })

  it('centers on an offset, height-constrained viewport', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, noRedraw, {
      zoom: 0.75,
      viewport: [0, 300, 1600, 600]
    })
    settle(ds)

    expect(screenCenterY(ds, bounds)).toBeCloseTo(600)
    expect(ds.scale).toBeCloseTo(1.5)
  })

  it.for([
    {
      name: 'animated',
      frame: (ds: DragAndScale, bounds: Bounds) => {
        ds.animateToBounds(bounds, noRedraw)
        settle(ds)
      }
    },
    {
      name: 'immediate',
      frame: (ds: DragAndScale, bounds: Bounds) => ds.fitToBounds(bounds)
    }
  ])(
    'frames a canvas still at its 300x150 default as 1920x1080 when $name',
    ({ frame }) => {
      const ds = new DragAndScale(
        createTestCanvasElement({ width: 300, height: 150 })
      )

      frame(ds, [0, 0, 100, 100])

      expect(ds.scale).toBeCloseTo(2.7)
      expect(ds.offset[0]).toBeCloseTo(960 / 2.7 - 50)
      expect(ds.offset[1]).toBeCloseTo(150)
    }
  )

  it('zooms geometrically around the viewport centre while it travels', () => {
    const ds = createDragAndScale()
    ds.animateToBounds([1000, 2000, 300, 300], noRedraw, {
      zoom: 1,
      duration: 400,
      viewport: [0, 0, 1200, 1200]
    })

    ds.advanceAnimation(START_TIME + 200)

    expect(ds.scale).toBeCloseTo(2)
    expect((875 + ds.offset[0]) * ds.scale).toBeCloseTo(600)
    expect((1375 + ds.offset[1]) * ds.scale).toBeCloseTo(600)
  })

  it('redraws after each step until the camera lands', () => {
    const ds = createDragAndScale()
    const redraw = vi.fn()
    ds.animateToBounds([0, 0, 100, 100], redraw, { zoom: 0 })

    ds.advanceAnimation(START_TIME + 100)
    settle(ds)
    settle(ds)

    expect(redraw).toHaveBeenCalledTimes(2)
  })

  it.for([
    ['width', [0, 0, 0, 900]],
    ['height', [0, 0, 1600, 0]]
  ] as const)(
    'leaves the camera for a viewport with no visible $0',
    ([, viewport]) => {
      const ds = createDragAndScale()
      const redraw = vi.fn()
      const before = cameraOf(ds)

      ds.animateToBounds([0, 0, 100, 100], redraw, { viewport })
      settle(ds)

      expect(cameraOf(ds)).toEqual(before)
      expect(redraw).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      name: 'a pan',
      move: (ds: DragAndScale) => {
        ds.offset = [ds.offset[0] + 40, ds.offset[1]]
      }
    },
    {
      name: 'an in-place pan',
      move: (ds: DragAndScale) => {
        ds.offset[0] += 40
      }
    },
    {
      name: 'a zoom',
      move: (ds: DragAndScale) => ds.changeScale(2, [200, 100])
    },
    {
      name: 'a reset',
      move: (ds: DragAndScale) => ds.reset()
    },
    {
      name: 'an immediate fit',
      move: (ds: DragAndScale) =>
        ds.fitToBounds([5000, 6000, 100, 100], { zoom: 0 })
    },
    {
      name: 'an immediate fit to an empty viewport',
      move: (ds: DragAndScale) =>
        ds.fitToBounds([5000, 6000, 100, 100], { viewport: [0, 0, 0, 0] })
    },
    {
      name: 'an animation to an empty viewport',
      move: (ds: DragAndScale) =>
        ds.animateToBounds([5000, 6000, 100, 100], noRedraw, {
          viewport: [0, 0, 0, 0]
        })
    }
  ])('leaves the camera to $name', ({ move }) => {
    const ds = createDragAndScale()
    ds.animateToBounds([3000, 3000, 100, 100], noRedraw, { zoom: 0 })
    ds.advanceAnimation(START_TIME + 100)

    move(ds)
    const moved = cameraOf(ds)
    settle(ds)

    expect(cameraOf(ds)).toEqual(moved)
  })

  it('hands the camera to a later animation', () => {
    const ds = createDragAndScale()
    const later: Bounds = [-2000, 500, 100, 100]
    ds.animateToBounds([3000, 3000, 100, 100], noRedraw, { zoom: 0 })
    ds.advanceAnimation(START_TIME + 100)

    ds.animateToBounds(later, noRedraw, { zoom: 0 })
    settle(ds)

    expect(screenCenterX(ds, later)).toBeCloseTo(800)
    expect(screenCenterY(ds, later)).toBeCloseTo(450)
  })
})
