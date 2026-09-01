import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relativeTime'

const labels = {
  justNow: 'just now',
  minutesAgo: (n: number) => `${n} min ago`,
  hoursAgo: (n: number) => `${n} hr ago`,
  daysAgo: (n: number) => `${n} days ago`
}

const now = new Date('2026-07-14T12:00:00Z')

function ago(ms: number) {
  return new Date(now.getTime() - ms)
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('reads "just now" under a minute', () => {
    expect(formatRelativeTime(ago(30 * SECOND), now, labels)).toBe('just now')
  })

  it('reads whole minutes under an hour', () => {
    expect(formatRelativeTime(ago(6 * MINUTE), now, labels)).toBe('6 min ago')
    expect(formatRelativeTime(ago(59 * MINUTE), now, labels)).toBe('59 min ago')
  })

  it('reads whole hours under a day', () => {
    expect(formatRelativeTime(ago(2 * HOUR), now, labels)).toBe('2 hr ago')
  })

  it('reads whole days beyond a day', () => {
    expect(formatRelativeTime(ago(3 * DAY), now, labels)).toBe('3 days ago')
  })

  it('never returns a negative bucket for a future timestamp', () => {
    expect(formatRelativeTime(ago(-5 * MINUTE), now, labels)).toBe('just now')
  })
})
