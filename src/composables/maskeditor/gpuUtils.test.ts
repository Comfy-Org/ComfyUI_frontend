import { describe, expect, it } from 'vitest'

import { buildStrokePoints, clampDirtyRect } from './gpuUtils'

const uninit = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity
}

describe('clampDirtyRect', () => {
  it('returns full canvas when dirty rect is uninitialised', () => {
    expect(clampDirtyRect(uninit, 100, 200)).toEqual({
      dx: 0,
      dy: 0,
      dw: 100,
      dh: 200
    })
  })

  it('returns the clamped rect when fully inside canvas bounds', () => {
    const rect = { minX: 10, minY: 20, maxX: 60, maxY: 90 }
    expect(clampDirtyRect(rect, 100, 200)).toEqual({
      dx: 10,
      dy: 20,
      dw: 50,
      dh: 70
    })
  })

  it('clamps rect that extends beyond canvas edges', () => {
    const rect = { minX: -5, minY: -10, maxX: 120, maxY: 250 }
    expect(clampDirtyRect(rect, 100, 200)).toEqual({
      dx: 0,
      dy: 0,
      dw: 100,
      dh: 200
    })
  })

  it('returns full canvas when the clamped area has zero width', () => {
    const rect = { minX: 50, minY: 10, maxX: 50, maxY: 80 }
    expect(clampDirtyRect(rect, 100, 200)).toEqual({
      dx: 0,
      dy: 0,
      dw: 100,
      dh: 200
    })
  })

  it('returns full canvas when the clamped area has zero height', () => {
    const rect = { minX: 10, minY: 50, maxX: 80, maxY: 50 }
    expect(clampDirtyRect(rect, 100, 200)).toEqual({
      dx: 0,
      dy: 0,
      dw: 100,
      dh: 200
    })
  })

  it('floors dx/dy and ceils the far edges', () => {
    const rect = { minX: 10.7, minY: 20.3, maxX: 59.2, maxY: 89.9 }
    const result = clampDirtyRect(rect, 100, 200)
    expect(result.dx).toBe(10)
    expect(result.dy).toBe(20)
    expect(result.dw).toBe(60 - 10) // ceil(59.2)=60, dx=10
    expect(result.dh).toBe(90 - 20) // ceil(89.9)=90, dy=20
  })
})

describe('buildStrokePoints', () => {
  it('returns input points as-is when skipResampling is true', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]
    const result = buildStrokePoints(points, true, 10)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ x: 0, y: 0, pressure: 1.0 })
    expect(result[1]).toEqual({ x: 100, y: 100, pressure: 1.0 })
  })

  it('returns empty array for empty input', () => {
    expect(buildStrokePoints([], false, 10)).toHaveLength(0)
    expect(buildStrokePoints([], true, 10)).toHaveLength(0)
  })

  it('returns empty array for a single point (no segments to interpolate)', () => {
    expect(buildStrokePoints([{ x: 5, y: 5 }], false, 10)).toHaveLength(0)
  })

  it('interpolates a horizontal segment into multiple evenly-spaced points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 30, y: 0 }
    ]
    const result = buildStrokePoints(points, false, 10)
    // 30px distance / 10 stepSize = 3 steps → 4 points (s=0,1,2,3)
    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ x: 0, y: 0 })
    expect(result[3]).toMatchObject({ x: 30, y: 0 })
    result.forEach((p) => expect(p.pressure).toBe(1.0))
  })

  it('uses at least one step when points are very close together', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 }
    ]
    // distance 0.1 < stepSize 10 → steps=1 → 2 points
    const result = buildStrokePoints(points, false, 10)
    expect(result).toHaveLength(2)
  })

  it('interpolates all pressure values to 1.0', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 50 }
    ]
    const result = buildStrokePoints(points, false, 10)
    result.forEach((p) => expect(p.pressure).toBe(1.0))
  })
})
