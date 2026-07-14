import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relativeTime'

const labels = {
  justNow: 'just now',
  minutesAgo: (n: number) => `${n} min ago`,
  hoursAgo: (n: number) => `${n} hr ago`,
  daysAgo: (n: number) => `${n} days ago`
}

const now = new Date('2026-07-03T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

describe('formatRelativeTime', () => {
  it('returns "just now" under a minute', () => {
    expect(formatRelativeTime(ago(30 * 1000), now, labels)).toBe('just now')
  })

  it('floors to whole minutes', () => {
    expect(formatRelativeTime(ago(6.9 * 60 * 1000), now, labels)).toBe(
      '6 min ago'
    )
  })

  it('floors to whole hours', () => {
    expect(formatRelativeTime(ago(2.9 * 60 * 60 * 1000), now, labels)).toBe(
      '2 hr ago'
    )
  })

  it('floors to whole days past 24h', () => {
    expect(
      formatRelativeTime(ago(3.9 * 24 * 60 * 60 * 1000), now, labels)
    ).toBe('3 days ago')
  })

  it.for([
    { elapsed: 60 * 1000, expected: '1 min ago' },
    { elapsed: 60 * 60 * 1000, expected: '1 hr ago' },
    { elapsed: 24 * 60 * 60 * 1000, expected: '1 days ago' }
  ])(
    'uses the next unit at the $elapsed ms boundary',
    ({ elapsed, expected }) => {
      expect(formatRelativeTime(ago(elapsed), now, labels)).toBe(expected)
    }
  )

  it('clamps future dates to "just now"', () => {
    expect(formatRelativeTime(ago(-5000), now, labels)).toBe('just now')
  })
})
