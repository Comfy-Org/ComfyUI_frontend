import { describe, expect, it } from 'vitest'

import type { CurvePoint } from '@/lib/litegraph/src/types/widgets'

import { createMonotoneInterpolator, curvesToLUT } from './curveUtils'

describe('createMonotoneInterpolator', () => {
  it('returns 0 for empty points', () => {
    const interpolate = createMonotoneInterpolator([])
    expect(interpolate(0.5)).toBe(0)
  })

  it('returns constant for single point', () => {
    const interpolate = createMonotoneInterpolator([[0.5, 0.7]])
    expect(interpolate(0)).toBe(0.7)
    expect(interpolate(1)).toBe(0.7)
  })

  it('passes through control points exactly', () => {
    const points: CurvePoint[] = [
      [0, 0],
      [0.5, 0.8],
      [1, 1]
    ]
    const interpolate = createMonotoneInterpolator(points)
    expect(interpolate(0)).toBeCloseTo(0, 5)
    expect(interpolate(0.5)).toBeCloseTo(0.8, 5)
    expect(interpolate(1)).toBeCloseTo(1, 5)
  })

  it('clamps to endpoint values outside range', () => {
    const points: CurvePoint[] = [
      [0.2, 0.3],
      [0.8, 0.9]
    ]
    const interpolate = createMonotoneInterpolator(points)
    expect(interpolate(0)).toBe(0.3)
    expect(interpolate(1)).toBe(0.9)
  })

  it('produces monotone output for monotone input', () => {
    const points: CurvePoint[] = [
      [0, 0],
      [0.25, 0.2],
      [0.5, 0.5],
      [0.75, 0.8],
      [1, 1]
    ]
    const interpolate = createMonotoneInterpolator(points)

    let prev = -Infinity
    for (let x = 0; x <= 1; x += 0.01) {
      const y = interpolate(x)
      expect(y).toBeGreaterThanOrEqual(prev)
      prev = y
    }
  })

  it('handles unsorted input points', () => {
    const points: CurvePoint[] = [
      [1, 1],
      [0, 0],
      [0.5, 0.5]
    ]
    const interpolate = createMonotoneInterpolator(points)
    expect(interpolate(0)).toBeCloseTo(0, 5)
    expect(interpolate(0.5)).toBeCloseTo(0.5, 5)
    expect(interpolate(1)).toBeCloseTo(1, 5)
  })
})

describe('curvesToLUT', () => {
  it('returns a 256-entry Uint8Array', () => {
    const lut = curvesToLUT([
      [0, 0],
      [1, 1]
    ])
    expect(lut).toBeInstanceOf(Uint8Array)
    expect(lut.length).toBe(256)
  })

  it('produces identity LUT for diagonal curve', () => {
    const lut = curvesToLUT([
      [0, 0],
      [1, 1]
    ])
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeCloseTo(i, 0)
    }
  })

  it('clamps output to [0, 255]', () => {
    const lut = curvesToLUT([
      [0, 0],
      [0.5, 1.5],
      [1, 1]
    ])
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(0)
      expect(lut[i]).toBeLessThanOrEqual(255)
    }
  })
})
