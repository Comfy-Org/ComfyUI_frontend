import { describe, expect, it } from 'vitest'

import type { CurvePoint } from './types'

import {
  createMonotoneInterpolator,
  curvesToLUT,
  histogramToPath
} from './curveUtils'

describe('createMonotoneInterpolator', () => {
  describe('degenerate inputs', () => {
    it('returns 0 for empty points', () => {
      const interpolate = createMonotoneInterpolator([])
      expect(interpolate(0)).toBe(0)
      expect(interpolate(0.5)).toBe(0)
      expect(interpolate(1)).toBe(0)
    })

    it('returns constant for single point', () => {
      const interpolate = createMonotoneInterpolator([[0.5, 0.7]])
      expect(interpolate(0)).toBe(0.7)
      expect(interpolate(0.5)).toBe(0.7)
      expect(interpolate(1)).toBe(0.7)
    })

    it('handles two points as linear segment', () => {
      const interpolate = createMonotoneInterpolator([
        [0, 0],
        [1, 1]
      ])
      expect(interpolate(0)).toBeCloseTo(0, 5)
      expect(interpolate(0.25)).toBeCloseTo(0.25, 5)
      expect(interpolate(0.5)).toBeCloseTo(0.5, 5)
      expect(interpolate(0.75)).toBeCloseTo(0.75, 5)
      expect(interpolate(1)).toBeCloseTo(1, 5)
    })

    it('handles duplicate x values', () => {
      const interpolate = createMonotoneInterpolator([
        [0.5, 0.2],
        [0.5, 0.8]
      ])
      // Should not throw or produce NaN
      const y = interpolate(0.5)
      expect(Number.isFinite(y)).toBe(true)
    })
  })

  describe('pass-through and interpolation', () => {
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

    it('passes through many control points exactly', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.1, 0.05],
        [0.3, 0.2],
        [0.5, 0.5],
        [0.7, 0.8],
        [0.9, 0.95],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      for (const [x, y] of points) {
        expect(interpolate(x)).toBeCloseTo(y, 5)
      }
    })

    it('interpolated values are between neighboring control points for monotone input', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.25, 0.1],
        [0.5, 0.5],
        [0.75, 0.9],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      // Test midpoints between each pair
      for (let i = 0; i < points.length - 1; i++) {
        const midX = (points[i][0] + points[i + 1][0]) / 2
        const y = interpolate(midX)
        const minY = Math.min(points[i][1], points[i + 1][1])
        const maxY = Math.max(points[i][1], points[i + 1][1])
        expect(y).toBeGreaterThanOrEqual(minY - 1e-10)
        expect(y).toBeLessThanOrEqual(maxY + 1e-10)
      }
    })
  })

  describe('clamping and boundary behavior', () => {
    it('clamps to endpoint values outside range', () => {
      const points: CurvePoint[] = [
        [0.2, 0.3],
        [0.8, 0.9]
      ]
      const interpolate = createMonotoneInterpolator(points)
      expect(interpolate(0)).toBe(0.3)
      expect(interpolate(0.1)).toBe(0.3)
      expect(interpolate(1)).toBe(0.9)
      expect(interpolate(1.5)).toBe(0.9)
    })

    it('clamps for negative x values', () => {
      const interpolate = createMonotoneInterpolator([
        [0, 0.5],
        [1, 1]
      ])
      expect(interpolate(-0.5)).toBe(0.5)
      expect(interpolate(-100)).toBe(0.5)
    })

    it('clamps for x values far beyond range', () => {
      const interpolate = createMonotoneInterpolator([
        [0, 0],
        [1, 1]
      ])
      expect(interpolate(1000)).toBe(1)
    })

    it('returns correct value at exact boundary x values', () => {
      const interpolate = createMonotoneInterpolator([
        [0, 0.2],
        [1, 0.8]
      ])
      expect(interpolate(0)).toBeCloseTo(0.2, 5)
      expect(interpolate(1)).toBeCloseTo(0.8, 5)
    })
  })

  describe('monotonicity', () => {
    it('produces monotone increasing output for monotone increasing input', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.25, 0.2],
        [0.5, 0.5],
        [0.75, 0.8],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)

      let prev = -Infinity
      for (let x = 0; x <= 1; x += 0.001) {
        const y = interpolate(x)
        expect(y).toBeGreaterThanOrEqual(prev - 1e-10)
        prev = y
      }
    })

    it('produces monotone decreasing output for monotone decreasing input', () => {
      const points: CurvePoint[] = [
        [0, 1],
        [0.25, 0.8],
        [0.5, 0.5],
        [0.75, 0.2],
        [1, 0]
      ]
      const interpolate = createMonotoneInterpolator(points)

      let prev = Infinity
      for (let x = 0; x <= 1; x += 0.001) {
        const y = interpolate(x)
        expect(y).toBeLessThanOrEqual(prev + 1e-10)
        prev = y
      }
    })

    it('preserves monotonicity with steep transitions', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.1, 0.01],
        [0.5, 0.5],
        [0.9, 0.99],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)

      let prev = -Infinity
      for (let x = 0; x <= 1; x += 0.001) {
        const y = interpolate(x)
        expect(y).toBeGreaterThanOrEqual(prev - 1e-10)
        prev = y
      }
    })
  })

  describe('sorting and ordering', () => {
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

    it('produces same result regardless of input order', () => {
      const sorted: CurvePoint[] = [
        [0, 0],
        [0.3, 0.4],
        [0.6, 0.7],
        [1, 1]
      ]
      const reversed: CurvePoint[] = [...sorted].reverse() as CurvePoint[]
      const shuffled: CurvePoint[] = [
        sorted[2],
        sorted[0],
        sorted[3],
        sorted[1]
      ]

      const f1 = createMonotoneInterpolator(sorted)
      const f2 = createMonotoneInterpolator(reversed)
      const f3 = createMonotoneInterpolator(shuffled)

      for (let x = 0; x <= 1; x += 0.05) {
        expect(f1(x)).toBeCloseTo(f2(x), 10)
        expect(f1(x)).toBeCloseTo(f3(x), 10)
      }
    })
  })

  describe('non-monotone and special curves', () => {
    it('handles flat segment (constant y)', () => {
      const points: CurvePoint[] = [
        [0, 0.5],
        [0.5, 0.5],
        [1, 0.5]
      ]
      const interpolate = createMonotoneInterpolator(points)
      for (let x = 0; x <= 1; x += 0.1) {
        expect(interpolate(x)).toBeCloseTo(0.5, 5)
      }
    })

    it('handles step-like curve with flat regions', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.4, 0],
        [0.6, 1],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      // Flat regions should stay flat
      expect(interpolate(0)).toBeCloseTo(0, 5)
      expect(interpolate(0.2)).toBeCloseTo(0, 5)
      expect(interpolate(0.8)).toBeCloseTo(1, 5)
      expect(interpolate(1)).toBeCloseTo(1, 5)
    })

    it('handles non-monotone (wave-like) input without NaN', () => {
      const points: CurvePoint[] = [
        [0, 0.5],
        [0.25, 1],
        [0.5, 0.5],
        [0.75, 0],
        [1, 0.5]
      ]
      const interpolate = createMonotoneInterpolator(points)
      for (let x = 0; x <= 1; x += 0.01) {
        const y = interpolate(x)
        expect(Number.isFinite(y)).toBe(true)
      }
      // Should pass through control points
      expect(interpolate(0)).toBeCloseTo(0.5, 5)
      expect(interpolate(0.25)).toBeCloseTo(1, 5)
      expect(interpolate(0.5)).toBeCloseTo(0.5, 5)
      expect(interpolate(0.75)).toBeCloseTo(0, 5)
      expect(interpolate(1)).toBeCloseTo(0.5, 5)
    })

    it('handles y values outside [0, 1]', () => {
      const points: CurvePoint[] = [
        [0, -0.5],
        [0.5, 2],
        [1, -1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      expect(interpolate(0)).toBeCloseTo(-0.5, 5)
      expect(interpolate(0.5)).toBeCloseTo(2, 5)
      expect(interpolate(1)).toBeCloseTo(-1, 5)
    })
  })

  describe('numerical precision', () => {
    it('handles very closely spaced x values', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.0001, 0.5],
        [0.0002, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      expect(interpolate(0)).toBeCloseTo(0, 5)
      expect(interpolate(0.0001)).toBeCloseTo(0.5, 5)
      expect(interpolate(0.0002)).toBeCloseTo(1, 5)
      expect(Number.isFinite(interpolate(0.00015))).toBe(true)
    })

    it('handles very large y values', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.5, 1e6],
        [1, 0]
      ]
      const interpolate = createMonotoneInterpolator(points)
      expect(interpolate(0.5)).toBeCloseTo(1e6, -1)
      expect(Number.isFinite(interpolate(0.25))).toBe(true)
    })

    it('returns finite values for all inputs across dense sampling', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.2, 0.3],
        [0.4, 0.7],
        [0.6, 0.4],
        [0.8, 0.9],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      for (let x = -0.1; x <= 1.1; x += 0.001) {
        expect(Number.isFinite(interpolate(x))).toBe(true)
      }
    })
  })

  describe('slope limiting (Fritsch-Carlson condition)', () => {
    it('limits slopes when alpha^2 + beta^2 > 9', () => {
      // Create points where slopes would be excessively steep
      // without the Fritsch-Carlson limiting
      const points: CurvePoint[] = [
        [0, 0],
        [0.1, 0.9],
        [0.2, 0.1],
        [0.3, 0.95],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      // Should still produce finite, reasonable values
      for (let x = 0; x <= 1; x += 0.01) {
        const y = interpolate(x)
        expect(Number.isFinite(y)).toBe(true)
      }
      // Should pass through control points
      expect(interpolate(0)).toBeCloseTo(0, 5)
      expect(interpolate(0.1)).toBeCloseTo(0.9, 5)
      expect(interpolate(0.2)).toBeCloseTo(0.1, 5)
    })
  })

  describe('binary search correctness', () => {
    it('produces continuous output across segment boundaries', () => {
      const points: CurvePoint[] = [
        [0, 0],
        [0.25, 0.3],
        [0.5, 0.6],
        [0.75, 0.8],
        [1, 1]
      ]
      const interpolate = createMonotoneInterpolator(points)
      // Test continuity at segment boundaries
      const eps = 1e-8
      for (const [x] of points.slice(1, -1)) {
        const left = interpolate(x - eps)
        const at = interpolate(x)
        const right = interpolate(x + eps)
        expect(Math.abs(left - at)).toBeLessThan(1e-4)
        expect(Math.abs(right - at)).toBeLessThan(1e-4)
      }
    })
  })
})

describe('histogramToPath', () => {
  describe('empty and zero inputs', () => {
    it('returns empty string for empty histogram', () => {
      expect(histogramToPath(new Uint32Array(0))).toBe('')
    })

    it('returns empty string when all bins are zero', () => {
      expect(histogramToPath(new Uint32Array(256))).toBe('')
    })
  })

  describe('path structure', () => {
    it('returns a closed SVG path starting at M0,1 and ending at L1,1 Z', () => {
      const histogram = new Uint32Array(256)
      for (let i = 0; i < 256; i++) histogram[i] = i + 1
      const path = histogramToPath(histogram)
      expect(path).toMatch(/^M0,1/)
      expect(path).toMatch(/L1,1 Z$/)
    })

    it('generates exactly 258 segments (M + 256 L + L1,1 Z)', () => {
      const histogram = new Uint32Array(256)
      histogram.fill(50)
      const path = histogramToPath(histogram)
      const parts = path.split(' ')
      // M0,1 + 256 L segments + "L1,1" + "Z"
      expect(parts.length).toBe(259) // M0,1, L0,y, L..., L1,y, L1,1, Z
    })

    it('x values span from 0 to 1 in 256 steps', () => {
      const histogram = new Uint32Array(256)
      histogram.fill(100)
      const path = histogramToPath(histogram)
      const segments = path.split(' ').filter((s) => s.startsWith('L'))
      // Remove the closing L1,1
      const dataSegments = segments.slice(0, -1)
      expect(dataSegments.length).toBe(256)

      const firstX = parseFloat(dataSegments[0].substring(1).split(',')[0])
      const lastX = parseFloat(
        dataSegments[dataSegments.length - 1].substring(1).split(',')[0]
      )
      expect(firstX).toBeCloseTo(0, 5)
      expect(lastX).toBeCloseTo(1, 5)
    })
  })

  describe('normalization', () => {
    it('normalizes using 99.5th percentile to suppress outliers', () => {
      const histogram = new Uint32Array(256)
      for (let i = 0; i < 256; i++) histogram[i] = 100
      histogram[255] = 100000
      const path = histogramToPath(histogram)
      // Most bins should map to y=0 (1 - 100/100 = 0) since
      // the 99.5th percentile is 100, not the outlier 100000
      const yValues = path
        .split(/[ML]/)
        .filter(Boolean)
        .map((s) => parseFloat(s.split(',')[1]))
        .filter((y) => !isNaN(y))
      const nearZero = yValues.filter((y) => Math.abs(y) < 0.01)
      expect(nearZero.length).toBeGreaterThan(200)
    })

    it('clamps values exceeding the percentile max to y=0', () => {
      const histogram = new Uint32Array(256)
      histogram.fill(50)
      // Set last two bins to extreme values
      histogram[254] = 500
      histogram[255] = 10000
      const path = histogramToPath(histogram)
      // The outlier bins should have their y values clamped to 0
      // (1 - min(1, val/max) where val > max -> y = 0)
      const segments = path.split(' ').filter((s) => s.startsWith('L'))
      const lastDataSegment = segments[segments.length - 2] // second to last L (before L1,1)
      const y = parseFloat(lastDataSegment.split(',')[1])
      expect(y).toBe(0)
    })

    it('uniform histogram produces uniform y values', () => {
      const histogram = new Uint32Array(256)
      histogram.fill(200)
      const path = histogramToPath(histogram)
      const yValues = path
        .split(/[ML]/)
        .filter(Boolean)
        .map((s) => parseFloat(s.split(',')[1]))
        .filter((y) => !isNaN(y))
      // Skip first (M0,1) and last (L1,1 Z) entries
      const dataYValues = yValues.slice(1, -1)
      // All should be near 0 (1 - 200/200 = 0)
      for (const y of dataYValues) {
        expect(y).toBeCloseTo(0, 5)
      }
    })
  })

  describe('single-bin histograms', () => {
    it('handles histogram with only one non-zero bin', () => {
      const histogram = new Uint32Array(256)
      histogram[128] = 1000
      const path = histogramToPath(histogram)
      // The 99.5th percentile of a mostly-zero array may be 0,
      // but since max is sorted[floor(255*0.995)] = sorted[253],
      // and we have 255 zeros and 1 non-zero, sorted[253] = 0
      // So max=0, function returns ''
      expect(path).toBe('')
    })

    it('handles histogram with a few non-zero bins', () => {
      const histogram = new Uint32Array(256)
      for (let i = 0; i < 10; i++) histogram[i] = 100
      const path = histogramToPath(histogram)
      // sorted[253] = 100 (non-zero bins sort to end), so path is generated
      // The non-zero bins should produce y < 1, zero bins produce y = 1
      expect(path).not.toBe('')
      expect(path).toMatch(/^M0,1/)
    })

    it('returns path when enough bins are non-zero', () => {
      const histogram = new Uint32Array(256)
      // Fill all bins to ensure percentile > 0
      histogram.fill(1)
      histogram[0] = 100
      const path = histogramToPath(histogram)
      expect(path).not.toBe('')
      expect(path).toMatch(/^M0,1/)
    })
  })

  describe('y value range', () => {
    it('all y values are in [0, 1]', () => {
      const histogram = new Uint32Array(256)
      for (let i = 0; i < 256; i++)
        histogram[i] = Math.floor(Math.random() * 1000) + 1
      const path = histogramToPath(histogram)
      const yValues = path
        .split(/[ML]/)
        .filter(Boolean)
        .map((s) => parseFloat(s.split(',')[1]))
        .filter((y) => !isNaN(y))
      for (const y of yValues) {
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(1)
      }
    })
  })
})

describe('curvesToLUT', () => {
  describe('basic properties', () => {
    it('returns a 256-entry Uint8Array', () => {
      const lut = curvesToLUT([
        [0, 0],
        [1, 1]
      ])
      expect(lut).toBeInstanceOf(Uint8Array)
      expect(lut.length).toBe(256)
    })

    it('all values are in [0, 255]', () => {
      const lut = curvesToLUT([
        [0, 0],
        [0.5, 0.8],
        [1, 0.2]
      ])
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBeGreaterThanOrEqual(0)
        expect(lut[i]).toBeLessThanOrEqual(255)
      }
    })
  })

  describe('identity and constant curves', () => {
    it('produces identity LUT for diagonal curve', () => {
      const lut = curvesToLUT([
        [0, 0],
        [1, 1]
      ])
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBeCloseTo(i, 0)
      }
    })

    it('produces constant LUT for flat curve', () => {
      const lut = curvesToLUT([
        [0, 0.5],
        [1, 0.5]
      ])
      const expected = Math.round(0.5 * 255) // 128
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBe(expected)
      }
    })

    it('produces all-zero LUT for y=0 curve', () => {
      const lut = curvesToLUT([
        [0, 0],
        [1, 0]
      ])
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBe(0)
      }
    })

    it('produces all-255 LUT for y=1 curve', () => {
      const lut = curvesToLUT([
        [0, 1],
        [1, 1]
      ])
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBe(255)
      }
    })
  })

  describe('clamping', () => {
    it('clamps output when interpolation exceeds 1', () => {
      const lut = curvesToLUT([
        [0, 0],
        [0.5, 1.5],
        [1, 1]
      ])
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBeLessThanOrEqual(255)
      }
    })

    it('clamps output when interpolation goes below 0', () => {
      const lut = curvesToLUT([
        [0, 0],
        [0.5, -0.5],
        [1, 0]
      ])
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('endpoint values', () => {
    it('first LUT entry matches curve y at x=0', () => {
      const lut = curvesToLUT([
        [0, 0.3],
        [1, 0.8]
      ])
      expect(lut[0]).toBe(Math.round(0.3 * 255))
    })

    it('last LUT entry matches curve y at x=1', () => {
      const lut = curvesToLUT([
        [0, 0.3],
        [1, 0.8]
      ])
      expect(lut[255]).toBe(Math.round(0.8 * 255))
    })
  })

  describe('monotonicity in LUT', () => {
    it('produces monotone increasing LUT for monotone increasing curve', () => {
      const lut = curvesToLUT([
        [0, 0],
        [0.25, 0.2],
        [0.5, 0.5],
        [0.75, 0.8],
        [1, 1]
      ])
      for (let i = 1; i < 256; i++) {
        expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1])
      }
    })

    it('produces monotone decreasing LUT for inverted curve', () => {
      const lut = curvesToLUT([
        [0, 1],
        [0.5, 0.5],
        [1, 0]
      ])
      for (let i = 1; i < 256; i++) {
        expect(lut[i]).toBeLessThanOrEqual(lut[i - 1])
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty points (all zeros)', () => {
      const lut = curvesToLUT([])
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBe(0)
      }
    })

    it('handles single point', () => {
      const lut = curvesToLUT([[0.5, 0.7]])
      const expected = Math.round(0.7 * 255) // 179
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBe(expected)
      }
    })

    it('values are rounded to nearest integer', () => {
      const lut = curvesToLUT([
        [0, 0.5],
        [1, 0.5]
      ])
      // 0.5 * 255 = 127.5 -> rounds to 128
      expect(lut[0]).toBe(128)
    })
  })
})
