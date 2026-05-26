import { describe, expect, it, vi } from 'vitest'

import { formatRelativeTime } from './relativeTime'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

function t(key: string, named?: { count: number }): string {
  return named ? `${key}:${named.count}` : key
}

describe('formatRelativeTime', () => {
  it('returns "now" when below one minute', () => {
    expect(formatRelativeTime(t, 0)).toBe('g.relativeTime.now')
    expect(formatRelativeTime(t, MINUTE_MS - 1)).toBe('g.relativeTime.now')
  })

  it('picks the largest unit that fits', () => {
    expect(formatRelativeTime(t, MINUTE_MS)).toBe('g.relativeTime.minutesAgo:1')
    expect(formatRelativeTime(t, 59 * MINUTE_MS)).toBe(
      'g.relativeTime.minutesAgo:59'
    )
    expect(formatRelativeTime(t, HOUR_MS)).toBe('g.relativeTime.hoursAgo:1')
    expect(formatRelativeTime(t, 23 * HOUR_MS)).toBe(
      'g.relativeTime.hoursAgo:23'
    )
    expect(formatRelativeTime(t, DAY_MS)).toBe('g.relativeTime.daysAgo:1')
    expect(formatRelativeTime(t, WEEK_MS)).toBe('g.relativeTime.weeksAgo:1')
    expect(formatRelativeTime(t, MONTH_MS)).toBe('g.relativeTime.monthsAgo:1')
    expect(formatRelativeTime(t, YEAR_MS)).toBe('g.relativeTime.yearsAgo:1')
  })

  it('passes the integer count to the translator', () => {
    const spy = vi.fn(t)
    formatRelativeTime(spy, 5 * MINUTE_MS + 30 * 1000)
    expect(spy).toHaveBeenCalledExactlyOnceWith('g.relativeTime.minutesAgo', {
      count: 5
    })
  })
})
