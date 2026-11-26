import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from './DragAndScale'
import { createTestCanvasElement } from './__fixtures__/canvasTestUtils'

type Bounds = [number, number, number, number]

let pendingFrames: Map<number, FrameRequestCallback>

function createDragAndScale() {
  return new DragAndScale(createTestCanvasElement({ width: 1600, height: 900 }))
}

function runFrame(timestamp: number) {
  const callbacks = [...pendingFrames.values()]
  pendingFrames.clear()
  for (const callback of callbacks) callback(timestamp)
}

function settle() {
  runFrame(performance.now() + 10_000)
}

function screenCenterX(ds: DragAndScale, bounds: Bounds) {
  return (bounds[0] + bounds[2] * 0.5 + ds.offset[0]) * ds.scale
}

function screenCenterY(ds: DragAndScale, bounds: Bounds) {
  return (bounds[1] + bounds[3] * 0.5 + ds.offset[1]) * ds.scale
}

describe('DragAndScale.animateToBounds', () => {
  beforeEach(() => {
    pendingFrames = new Map()
    let nextFrame = 0
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.set(++nextFrame, callback)
      return nextFrame
    })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) =>
      pendingFrames.delete(frame)
    )
  })

  it('centers bounds on the full canvas by default', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), { zoom: 0 })
    settle()

    expect(screenCenterX(ds, bounds)).toBeCloseTo(800)
  })

  it('centers and fits bounds within a narrower viewport', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), {
      zoom: 0.75,
      viewport: [0, 0, 1100, 900]
    })
    settle()

    expect(screenCenterX(ds, bounds)).toBeCloseTo(550)
    expect(ds.scale).toBeCloseTo(2.25)
  })

  it('centers on an offset, width-constrained viewport', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), {
      zoom: 0.75,
      viewport: [400, 0, 600, 900]
    })
    settle()

    expect(screenCenterX(ds, bounds)).toBeCloseTo(700)
    expect(ds.scale).toBeCloseTo(1.5)
  })

  it('centers on an offset, height-constrained viewport', () => {
    const ds = createDragAndScale()
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), {
      zoom: 0.75,
      viewport: [0, 300, 1600, 600]
    })
    settle()

    expect(screenCenterY(ds, bounds)).toBeCloseTo(600)
    expect(ds.scale).toBeCloseTo(1.5)
  })

  it.for([
    ['width', [0, 0, 0, 900]],
    ['height', [0, 0, 1600, 0]]
  ] as const)('ignores a viewport with no visible $0', ([, viewport]) => {
    const ds = createDragAndScale()
    const setDirty = vi.fn()
    const offsetBefore = [...ds.offset]
    const scaleBefore = ds.scale

    ds.animateToBounds([0, 0, 100, 100], setDirty, {
      viewport
    })

    expect(pendingFrames.size).toBe(0)
    expect(setDirty).not.toHaveBeenCalled()
    expect([...ds.offset]).toEqual(offsetBefore)
    expect(ds.scale).toBe(scaleBefore)
  })

  it.for([
    {
      name: 'a pan',
      move: (ds: DragAndScale) => {
        ds.offset[0] += 40
      }
    },
    {
      name: 'a zoom',
      move: (ds: DragAndScale) => ds.changeScale(2, [200, 100])
    },
    {
      name: 'an immediate fit',
      move: (ds: DragAndScale) =>
        ds.fitToBounds([5000, 6000, 100, 100], { zoom: 0 })
    }
  ])('leaves the camera to $name made while it runs', ({ move }) => {
    const ds = createDragAndScale()
    ds.animateToBounds([3000, 3000, 100, 100], vi.fn(), { zoom: 0 })
    runFrame(performance.now() + 100)

    move(ds)
    const moved = { offset: [...ds.offset], scale: ds.scale }
    settle()

    expect({ offset: [...ds.offset], scale: ds.scale }).toEqual(moved)
  })

  it('stops for an immediate fit that leaves the camera where it is', () => {
    const ds = createDragAndScale()
    ds.animateToBounds([3000, 3000, 100, 100], vi.fn(), { zoom: 0 })

    ds.fitToBounds([750, 400, 100, 100], { zoom: 0 })
    settle()

    expect({ offset: [...ds.offset], scale: ds.scale }).toEqual({
      offset: [0, 0],
      scale: 1
    })
  })

  it('stops when a redraw asks it to', () => {
    const ds = createDragAndScale()
    ds.animateToBounds([3000, 3000, 100, 100], () => ds.stopAnimation(), {
      zoom: 0
    })
    runFrame(performance.now() + 100)
    const stopped = { offset: [...ds.offset], scale: ds.scale }

    settle()

    expect({ offset: [...ds.offset], scale: ds.scale }).toEqual(stopped)
  })

  it('hands the camera to a later animation', () => {
    const ds = createDragAndScale()
    const later: Bounds = [-2000, 500, 100, 100]
    ds.animateToBounds([3000, 3000, 100, 100], vi.fn(), { zoom: 0 })
    runFrame(performance.now() + 100)

    ds.animateToBounds(later, vi.fn(), { zoom: 0 })
    settle()

    expect(screenCenterX(ds, later)).toBeCloseTo(800)
    expect(screenCenterY(ds, later)).toBeCloseTo(450)
  })
})
