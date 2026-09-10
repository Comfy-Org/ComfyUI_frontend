import { describe, expect, it } from 'vitest'

import { formatAnimationTime } from '@/components/load3d/formatAnimationTime'

describe('formatAnimationTime', () => {
  it.for([
    [0, '0.0s'],
    [2.5, '2.5s'],
    [59.96, '60.0s'],
    [60, '1:00.0'],
    [75.25, '1:15.3'],
    [605.04, '10:05.0']
  ] as const)('formats %s seconds as %s', ([seconds, expected]) => {
    expect(formatAnimationTime(seconds)).toBe(expected)
  })
})
