import { describe, expect, it } from 'vitest'

import { histogramToPath } from './histogramUtil'

describe('histogramToPath', () => {
  it('returns empty string for empty histogram', () => {
    expect(histogramToPath(new Uint32Array(0))).toBe('')
  })

  it('returns empty string when all bins are zero', () => {
    expect(histogramToPath(new Uint32Array(256))).toBe('')
  })

  it('returns a closed SVG path for valid histogram', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++) histogram[i] = i + 1
    const path = histogramToPath(histogram)
    expect(path).toMatch(/^M0,1/)
    expect(path).toMatch(/L1,1 Z$/)
  })

  it('normalizes using 99.5th percentile to suppress outliers', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++) histogram[i] = 100
    histogram[255] = 100000
    const path = histogramToPath(histogram)
    const yValues = path
      .split(/[ML]/)
      .filter(Boolean)
      .map((s) => parseFloat(s.split(',')[1]))
      .filter((y) => !isNaN(y))
    const nearZero = yValues.filter((y) => Math.abs(y) < 0.01)
    expect(nearZero.length).toBeGreaterThan(200)
  })
})
