import { describe, expect, it } from 'vitest'

import { locateSequenceTime, sequenceStarts } from './videoSequence'

describe('sequenceStarts', () => {
  it('accumulates durations into start times', () => {
    expect(sequenceStarts([2, 3, 1.5])).toEqual([0, 2, 5])
  })
})

describe('locateSequenceTime', () => {
  it.for([
    { durations: [2, 3, 1.5], time: 0, expected: { index: 0, offset: 0 } },
    { durations: [2, 3, 1.5], time: 2.5, expected: { index: 1, offset: 0.5 } },
    { durations: [2, 3, 1.5], time: 5, expected: { index: 2, offset: 0 } },
    {
      durations: [2, 3, 1.5],
      time: 99,
      expected: { index: 2, offset: 1.5 }
    },
    { durations: [2, 3, 1.5], time: -1, expected: { index: 0, offset: 0 } },
    { durations: [2, 0, 3], time: 2, expected: { index: 2, offset: 0 } },
    { durations: [], time: 1, expected: { index: 0, offset: 0 } }
  ])(
    'places $time within $durations at $expected',
    ({ durations, time, expected }) => {
      expect(locateSequenceTime(durations, time)).toEqual(expected)
    }
  )
})
