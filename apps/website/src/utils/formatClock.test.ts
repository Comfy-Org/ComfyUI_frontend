import { describe, expect, it } from 'vitest'

import { formatClock } from './formatClock'

describe('formatClock', () => {
  it.for([
    { seconds: 0, expected: '00:00' },
    { seconds: 9.9, expected: '00:09' },
    { seconds: 65, expected: '01:05' },
    { seconds: 3599, expected: '59:59' },
    { seconds: 3600, expected: '60:00' }
  ])('formats $seconds seconds as $expected', ({ seconds, expected }) => {
    expect(formatClock(seconds)).toBe(expected)
  })
})
