import { describe, expect, it } from 'vitest'

import {
  classifyChange,
  computeStats,
  formatSignificance,
  isNoteworthy,
  sparkline,
  trendArrow,
  trendDirection,
  zScore
} from './perf-stats'

describe('computeStats', () => {
  it('returns zeros for empty array', () => {
    const stats = computeStats([])
    expect(stats).toEqual({ mean: 0, stddev: 0, min: 0, max: 0, n: 0 })
  })

  it('returns value with zero stddev for single element', () => {
    const stats = computeStats([42])
    expect(stats).toEqual({ mean: 42, stddev: 0, min: 42, max: 42, n: 1 })
  })

  it('computes correct stats for known values', () => {
    // Values: [2, 4, 4, 4, 5, 5, 7, 9]
    // Mean = 5, sample variance ≈ 4.57, sample stddev ≈ 2.14
    const stats = computeStats([2, 4, 4, 4, 5, 5, 7, 9])
    expect(stats.mean).toBe(5)
    expect(stats.stddev).toBeCloseTo(2.138, 2)
    expect(stats.min).toBe(2)
    expect(stats.max).toBe(9)
    expect(stats.n).toBe(8)
  })

  it('uses sample stddev (n-1 denominator)', () => {
    // [10, 20] → mean=15, variance=(25+25)/1=50, stddev≈7.07
    const stats = computeStats([10, 20])
    expect(stats.mean).toBe(15)
    expect(stats.stddev).toBeCloseTo(7.071, 2)
    expect(stats.n).toBe(2)
  })

  it('handles identical values', () => {
    const stats = computeStats([5, 5, 5, 5])
    expect(stats.mean).toBe(5)
    expect(stats.stddev).toBe(0)
  })
})

describe('zScore', () => {
  it('returns null when stddev is 0', () => {
    const stats = computeStats([5, 5, 5])
    expect(zScore(10, stats)).toBeNull()
  })

  it('returns null when n < 2', () => {
    const stats = computeStats([5])
    expect(zScore(10, stats)).toBeNull()
  })

  it('computes correct z-score', () => {
    const stats = { mean: 100, stddev: 10, min: 80, max: 120, n: 5 }
    expect(zScore(120, stats)).toBe(2)
    expect(zScore(80, stats)).toBe(-2)
    expect(zScore(100, stats)).toBe(0)
  })
})

describe('classifyChange', () => {
  it('returns noisy when CV > 50%', () => {
    expect(classifyChange(3, 60)).toBe('noisy')
    expect(classifyChange(-3, 51)).toBe('noisy')
  })

  it('does not classify as noisy when CV is exactly 50%', () => {
    expect(classifyChange(3, 50)).toBe('regression')
    expect(classifyChange(-3, 50)).toBe('improvement')
  })

  it('returns neutral when z is null', () => {
    expect(classifyChange(null, 10)).toBe('neutral')
  })

  it('returns regression when z > 2', () => {
    expect(classifyChange(2.1, 10)).toBe('regression')
    expect(classifyChange(5, 10)).toBe('regression')
  })

  it('returns improvement when z < -2', () => {
    expect(classifyChange(-2.1, 10)).toBe('improvement')
    expect(classifyChange(-5, 10)).toBe('improvement')
  })

  it('returns neutral when z is within [-2, 2]', () => {
    expect(classifyChange(0, 10)).toBe('neutral')
    expect(classifyChange(1.9, 10)).toBe('neutral')
    expect(classifyChange(-1.9, 10)).toBe('neutral')
    expect(classifyChange(2, 10)).toBe('neutral')
    expect(classifyChange(-2, 10)).toBe('neutral')
  })

  it('returns neutral when absDelta below minAbsDelta despite high z', () => {
    // z=7.2 but only 1 unit change with minAbsDelta=5
    expect(classifyChange(7.2, 10, 1, 5)).toBe('neutral')
    expect(classifyChange(-7.2, 10, -1, 5)).toBe('neutral')
  })

  it('returns regression when absDelta meets minAbsDelta', () => {
    expect(classifyChange(3, 10, 10, 5)).toBe('regression')
  })

  it('ignores effect size gate when minAbsDelta not provided', () => {
    expect(classifyChange(3, 10)).toBe('regression')
    expect(classifyChange(3, 10, 1)).toBe('regression')
  })
})

describe('formatSignificance', () => {
  it('formats regression with z-score and emoji', () => {
    expect(formatSignificance('regression', 3.2)).toBe('⚠️ z=3.2')
  })

  it('formats improvement with z-score without emoji', () => {
    expect(formatSignificance('improvement', -2.5)).toBe('z=-2.5')
  })

  it('formats noisy as descriptive text', () => {
    expect(formatSignificance('noisy', null)).toBe('variance too high')
  })

  it('formats neutral with z-score without emoji', () => {
    expect(formatSignificance('neutral', 0.5)).toBe('z=0.5')
  })

  it('formats neutral without z-score as dash', () => {
    expect(formatSignificance('neutral', null)).toBe('—')
  })
})

describe('isNoteworthy', () => {
  it('returns true for regressions', () => {
    expect(isNoteworthy('regression')).toBe(true)
  })

  it('returns false for non-regressions', () => {
    expect(isNoteworthy('improvement')).toBe(false)
    expect(isNoteworthy('neutral')).toBe(false)
    expect(isNoteworthy('noisy')).toBe(false)
  })
})

describe('sparkline', () => {
  it('returns empty string for no values', () => {
    expect(sparkline([])).toBe('')
  })

  it('returns mid-height for single value', () => {
    expect(sparkline([50])).toBe('▄')
  })

  it('renders ascending values low to high', () => {
    const result = sparkline([0, 25, 50, 75, 100])
    expect(result).toBe('▁▃▅▆█')
  })

  it('renders identical values as flat line', () => {
    const result = sparkline([10, 10, 10])
    expect(result).toBe('▄▄▄')
  })

  it('renders descending values high to low', () => {
    const result = sparkline([100, 50, 0])
    expect(result).toBe('█▅▁')
  })
})

describe('trendDirection', () => {
  it('returns stable for fewer than 3 values', () => {
    expect(trendDirection([])).toBe('stable')
    expect(trendDirection([1])).toBe('stable')
    expect(trendDirection([1, 2])).toBe('stable')
  })

  it('detects rising trend', () => {
    expect(trendDirection([10, 10, 10, 20, 20, 20])).toBe('rising')
  })

  it('detects falling trend', () => {
    expect(trendDirection([20, 20, 20, 10, 10, 10])).toBe('falling')
  })

  it('returns stable for flat data', () => {
    expect(trendDirection([100, 100, 100, 100])).toBe('stable')
  })

  it('returns stable for small fluctuations within 10%', () => {
    expect(trendDirection([100, 100, 100, 105, 105, 105])).toBe('stable')
  })

  it('detects rising when baseline is zero but current is non-zero', () => {
    expect(trendDirection([0, 0, 0, 5, 5, 5])).toBe('rising')
  })

  it('returns stable when both halves are zero', () => {
    expect(trendDirection([0, 0, 0, 0, 0, 0])).toBe('stable')
  })
})

describe('trendArrow', () => {
  it('returns correct emoji for each direction', () => {
    expect(trendArrow('rising')).toBe('📈')
    expect(trendArrow('falling')).toBe('📉')
    expect(trendArrow('stable')).toBe('➡️')
  })
})
