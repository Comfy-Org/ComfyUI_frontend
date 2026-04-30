import { describe, expect, it } from 'vitest'

import { clampDirtyRect } from './gpuUtils'

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
