import { describe, expect, it } from 'vitest'

import { computeChannelHistograms, computeImageStats } from './hdrStats'

function reader(values: number[]) {
  return (i: number) => values[i]
}

describe('computeImageStats', () => {
  it('computes min/max/mean over RGB, skipping alpha', () => {
    const data = [0, 0.5, 1, 1, 0.2, 0.4, 0.6, 1]
    const stats = computeImageStats(reader(data), data.length, 4)
    expect(stats.min).toBe(0)
    expect(stats.max).toBe(1)
    expect(stats.mean).toBeCloseTo((0 + 0.5 + 1 + 0.2 + 0.4 + 0.6) / 6, 6)
  })

  it('counts NaN and Inf and excludes them from min/max/mean', () => {
    const data = [0.5, NaN, Infinity, -Infinity, 0.25]
    const stats = computeImageStats(reader(data), data.length, 3)
    expect(stats.nanCount).toBe(1)
    expect(stats.infCount).toBe(2)
    expect(stats.min).toBe(0.25)
    expect(stats.max).toBe(0.5)
    expect(stats.mean).toBeCloseTo(0.375, 6)
  })

  it('counts NaN/Inf in alpha but keeps alpha out of min/max/mean', () => {
    const data = [0.1, 0.2, 0.3, NaN, 0.4, 0.5, 0.6, Infinity]
    const stats = computeImageStats(reader(data), data.length, 4)
    expect(stats.nanCount).toBe(1)
    expect(stats.infCount).toBe(1)
    expect(stats.min).toBe(0.1)
    expect(stats.max).toBe(0.6)
    expect(stats.mean).toBeCloseTo((0.1 + 0.2 + 0.3 + 0.4 + 0.5 + 0.6) / 6, 6)
  })

  it('reports HDR values above one', () => {
    const data = [2, 4, 8]
    const stats = computeImageStats(reader(data), data.length, 3)
    expect(stats.max).toBe(8)
    expect(stats.mean).toBeCloseTo(14 / 3, 6)
  })

  it('returns zeros when there are no finite samples', () => {
    const data = [NaN, Infinity]
    const stats = computeImageStats(reader(data), data.length, 3)
    expect(stats).toEqual({
      min: 0,
      max: 0,
      mean: 0,
      stdDev: 0,
      nanCount: 1,
      infCount: 1
    })
  })
})

describe('computeChannelHistograms', () => {
  it('bins each channel independently', () => {
    const data = [0, 0.5, 1, 0.5, 0.5, 0.5]
    const hist = computeChannelHistograms(reader(data), data.length, 3, 4)
    expect(hist.r[0]).toBe(1)
    expect(hist.r[2]).toBe(1)
    expect(hist.g[2]).toBe(2)
    expect(hist.b[3]).toBe(1)
    expect(hist.a).toBeNull()
  })

  it('builds an alpha histogram for RGBA data', () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 0]
    const hist = computeChannelHistograms(reader(data), data.length, 4, 4)
    expect(hist.a).not.toBeNull()
    expect(hist.a![3]).toBe(1)
    expect(hist.a![0]).toBe(1)
  })

  it('clamps HDR values above one into the last bin', () => {
    const data = [8, 8, 8]
    const hist = computeChannelHistograms(reader(data), data.length, 3, 4)
    expect(hist.luminance[3]).toBe(1)
    expect(hist.r[3]).toBe(1)
  })

  it('skips NaN samples per channel', () => {
    const data = [NaN, 0.5, 0.5]
    const hist = computeChannelHistograms(reader(data), data.length, 3, 4)
    expect(hist.r.reduce((a, b) => a + b, 0)).toBe(0)
    expect(hist.g.reduce((a, b) => a + b, 0)).toBe(1)
  })
})
