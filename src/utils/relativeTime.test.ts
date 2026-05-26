import { describe, expect, it, vi } from 'vitest'

import { formatRelativeTime } from './relativeTime'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

function t(key: string, named?: { count: number }): string {
  return named ? `${key}:${named.count}` : key
}

describe('formatRelativeTime', () => {
  it('returns "now" when below one minute', () => {
    expect(formatRelativeTime(t, 0)).toBe('g.relativeTime.now')
    expect(formatRelativeTime(t, MINUTE - 1)).toBe('g.relativeTime.now')
  })

  it('picks the largest unit that fits', () => {
    expect(formatRelativeTime(t, MINUTE)).toBe('g.relativeTime.minutesAgo:1')
    expect(formatRelativeTime(t, 59 * MINUTE)).toBe(
      'g.relativeTime.minutesAgo:59'
    )
    expect(formatRelativeTime(t, HOUR)).toBe('g.relativeTime.hoursAgo:1')
    expect(formatRelativeTime(t, 23 * HOUR)).toBe('g.relativeTime.hoursAgo:23')
    expect(formatRelativeTime(t, DAY)).toBe('g.relativeTime.daysAgo:1')
    expect(formatRelativeTime(t, WEEK)).toBe('g.relativeTime.weeksAgo:1')
    expect(formatRelativeTime(t, MONTH)).toBe('g.relativeTime.monthsAgo:1')
    expect(formatRelativeTime(t, YEAR)).toBe('g.relativeTime.yearsAgo:1')
  })

  it('passes the integer count to the translator', () => {
    const spy = vi.fn(t)
    formatRelativeTime(spy, 5 * MINUTE + 30 * 1000)
    expect(spy).toHaveBeenCalledExactlyOnceWith('g.relativeTime.minutesAgo', {
      count: 5
    })
  })
})
