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
    startBoundaryTimedOut: false,
    boundaryTimedOut: false,
    ...overrides
  }
}

describe('rAF measurement validity', () => {
  it('summarizes percentiles and strict budget buckets without mutation', () => {
    const intervals = [
      100,
      ...Array<number>(91).fill(8.33),
      8.34,
      16.67,
      16.68,
      33.3,
      33.31,
      50,
      50.01,
      60
    ]
    const originalIntervals = [...intervals]

    expect(summarizeRafIntervals(intervals)).toEqual({
      rafIntervalCount: 100,
      rafIntervalP50Ms: 8.33,
      rafIntervalP95Ms: 33.3,
      rafIntervalP99Ms: 60,
      rafIntervalMaxMs: 100,
      rafIntervalsOver8_33Ms: 9,
      rafIntervalsOver16_67Ms: 7,
      rafIntervalsOver33_3Ms: 5,
      rafIntervalsOver50Ms: 3
    })
    expect(intervals).toEqual(originalIntervals)
    expect(summarizeRafIntervals([])).toEqual({
      rafIntervalCount: 0,
      rafIntervalP50Ms: 0,
      rafIntervalP95Ms: 0,
      rafIntervalP99Ms: 0,
      rafIntervalMaxMs: 0,
      rafIntervalsOver8_33Ms: 0,
      rafIntervalsOver16_67Ms: 0,
      rafIntervalsOver33_3Ms: 0,
      rafIntervalsOver50Ms: 0
    })
  })

  const validityCases: [RafCollection | null, string | null][] = [
    [null, 'rAF collector missing at stop'],
    [
      collection({ startBoundaryTimedOut: true }),
      'rAF start boundary timed out'
    ],
    [collection({ boundaryTimedOut: true }), 'rAF stop boundary timed out'],
    [
      collection({ visibilityChanged: true }),
      'document visibility toggled during the measurement window'
    ],
    [
      collection({ startVisibility: 'hidden' }),
      'document visibility changed (hidden to visible)'
    ],
    [
      collection({ intervalsMs: [Number.NaN] }),
      'rAF timestamps were non-monotonic'
    ],
    [collection({ intervalsMs: [0] }), 'rAF timestamps were non-monotonic'],
    [
      collection({ intervalsMs: [] }),
      'measurement window contained no rAF intervals'
    ],
    [collection(), null]
  ]

  it.for(validityCases)(
    'classifies collection validity',
    ([value, expected]) => {
      expect(getRafRejectionReason(value)).toBe(expected)
    }
  )
})
