import { describe, expect, it } from 'vitest'

import type { RafCollection } from '../browser_tests/fixtures/helpers/rafMetrics'
import {
  getRafRejectionReason,
  summarizeRafIntervals
} from '../browser_tests/fixtures/helpers/rafMetrics'

function collection(overrides: Partial<RafCollection> = {}): RafCollection {
  return {
    intervalsMs: [16],
    startVisibility: 'visible',
    endVisibility: 'visible',
    visibilityChanged: false,
    boundaryTimedOut: false,
    ...overrides
  }
}

describe('rAF measurement validity', () => {
  it('summarizes percentiles and strict budget buckets without mutation', () => {
    const intervals = [8.33, 8.34, 16.67, 16.68, 33.3, 33.31, 50, 50.01]

    expect(summarizeRafIntervals(intervals)).toEqual({
      rafIntervalCount: 8,
      rafIntervalP50Ms: 16.68,
      rafIntervalP95Ms: 50.01,
      rafIntervalP99Ms: 50.01,
      rafIntervalMaxMs: 50.01,
      rafIntervalsOver8_33Ms: 7,
      rafIntervalsOver16_67Ms: 5,
      rafIntervalsOver33_3Ms: 3,
      rafIntervalsOver50Ms: 1
    })
    expect(intervals).toEqual([
      8.33, 8.34, 16.67, 16.68, 33.3, 33.31, 50, 50.01
    ])
  })

  it.for([
    [null, 'rAF collector missing at stop'],
    [collection({ boundaryTimedOut: true }), 'rAF stop boundary timed out'],
    [
      collection({ visibilityChanged: true }),
      'document visibility changed (visible to visible)'
    ],
    [
      collection({ startVisibility: 'hidden' }),
      'document visibility changed (hidden to visible)'
    ],
    [
      collection({ intervalsMs: [Number.NaN] }),
      'rAF timestamps were non-monotonic'
    ],
    [
      collection({ intervalsMs: [] }),
      'measurement window contained no rAF intervals'
    ],
    [collection(), null]
  ])('classifies collection validity', ([value, expected]) => {
    expect(getRafRejectionReason(value)).toBe(expected)
  })
})
