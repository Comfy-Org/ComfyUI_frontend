import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'

type Bounds = [number, number, number, number]

let pendingFrame: FrameRequestCallback | undefined

function createDragAndScale() {
  return new DragAndScale({ width: 1600, height: 900 } as HTMLCanvasElement)
}

function settle() {
  pendingFrame?.(performance.now() + 10_000)
}

function screenCenterX(ds: DragAndScale, bounds: Bounds) {
  return (bounds[0] + bounds[2] * 0.5 + ds.offset[0]) * ds.scale
}

function screenCenterY(ds: DragAndScale, bounds: Bounds) {
  return (bounds[1] + bounds[3] * 0.5 + ds.offset[1]) * ds.scale
}

describe('DragAndScale.animateToBounds', () => {
  beforeEach(() => {
    pendingFrame = undefined
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrame = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
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
    ['height', [0, 0, 1600, 0]],
    ['negative width', [0, 0, -200, 900]],
    ['NaN width', [0, 0, Number.NaN, 900]]
  ] as const)('ignores a viewport with no visible $0', ([, viewport]) => {
    const ds = createDragAndScale()
    const setDirty = vi.fn()
    const offsetBefore = [...ds.offset]
    const scaleBefore = ds.scale

    ds.animateToBounds([0, 0, 100, 100], setDirty, {
      viewport
    })

    expect(pendingFrame).toBeUndefined()
    expect(setDirty).not.toHaveBeenCalled()
    expect([...ds.offset]).toEqual(offsetBefore)
    expect(ds.scale).toBe(scaleBefore)
  })
})
