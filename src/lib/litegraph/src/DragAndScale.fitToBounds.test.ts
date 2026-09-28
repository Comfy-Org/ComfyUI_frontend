import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'

const BOUNDS: ReadOnlyRect = [26, 156, 1635, 559]

function createDragAndScale(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  return new DragAndScale(element)
}

function screenCenterX(ds: DragAndScale, bounds: ReadOnlyRect) {
  return (bounds[0] + bounds[2] * 0.5 + ds.offset[0]) * ds.scale
}

function screenCenterY(ds: DragAndScale, bounds: ReadOnlyRect) {
  return (bounds[1] + bounds[3] * 0.5 + ds.offset[1]) * ds.scale
}

describe('DragAndScale.fitToBounds', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 1)
  })

  it('centers and fits the bounds on a visible canvas', () => {
    const ds = createDragAndScale(1600, 900)

    ds.fitToBounds(BOUNDS)

    expect(ds.scale).toBeCloseTo(0.7339)
    expect(screenCenterX(ds, BOUNDS)).toBeCloseTo(800)
    expect(screenCenterY(ds, BOUNDS)).toBeCloseTo(450)
  })

  it('substitutes a default size for an uninitialised 300x150 element', () => {
    const ds = createDragAndScale(300, 150)

    ds.fitToBounds(BOUNDS)

    expect(ds.scale).toBeCloseTo(0.8807)
    expect(screenCenterX(ds, BOUNDS)).toBeCloseTo(960)
    expect(screenCenterY(ds, BOUNDS)).toBeCloseTo(540)
  })

  it.for([
    ['both axes collapsed', 0, 0],
    ['width collapsed', 0, 900],
    ['height collapsed', 1600, 0]
  ] as const)(
    'leaves the view untouched when the canvas is hidden — %s',
    ([, width, height]) => {
      const ds = createDragAndScale(width, height)
      const offsetBefore = [...ds.offset]
      const scaleBefore = ds.scale

      ds.fitToBounds(BOUNDS)

      expect(ds.offset.every(Number.isFinite)).toBe(true)
      expect(ds.scale).toBeGreaterThan(0)
      expect([...ds.offset]).toEqual(offsetBefore)
      expect(ds.scale).toBe(scaleBefore)
    }
  )
})
