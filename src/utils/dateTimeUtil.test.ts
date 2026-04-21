import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dateKey,
  formatClockTime,
  formatShortMonthDay,
  isToday,
  isYesterday
} from './dateTimeUtil'

describe('dateKey', () => {
  it('returns YYYY-MM-DD for a given timestamp', () => {
    // 2024-03-15 in UTC
    const ts = new Date(2024, 2, 15, 10, 30).getTime()
    expect(dateKey(ts)).toBe('2024-03-15')
  })

  it('zero-pads single-digit months and days', () => {
    const ts = new Date(2024, 0, 5).getTime()
    expect(dateKey(ts)).toBe('2024-01-05')
  })
})

describe('isToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 15, 14, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for a timestamp on the same day', () => {
    const ts = new Date(2024, 5, 15, 8, 0, 0).getTime()
    expect(isToday(ts)).toBe(true)
  })

  it('returns false for yesterday', () => {
    const ts = new Date(2024, 5, 14, 23, 59, 59).getTime()
    expect(isToday(ts)).toBe(false)
  })

  it('returns false for tomorrow', () => {
    const ts = new Date(2024, 5, 16, 0, 0, 0).getTime()
    expect(isToday(ts)).toBe(false)
  })
})

describe('isYesterday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 15, 14, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for a timestamp yesterday', () => {
    const ts = new Date(2024, 5, 14, 10, 0, 0).getTime()
    expect(isYesterday(ts)).toBe(true)
  })

  it('returns false for today', () => {
    const ts = new Date(2024, 5, 15, 10, 0, 0).getTime()
    expect(isYesterday(ts)).toBe(false)
  })

  it('returns false for two days ago', () => {
    const ts = new Date(2024, 5, 13, 10, 0, 0).getTime()
    expect(isYesterday(ts)).toBe(false)
  })
})

describe('formatShortMonthDay', () => {
  it('formats a date as short month + day', () => {
    const ts = new Date(2024, 0, 2, 12, 0, 0).getTime()
    const result = formatShortMonthDay(ts, 'en-US')
    expect(result).toBe('Jan 2')
  })
})

describe('formatClockTime', () => {
  it('formats time with hours, minutes, and seconds', () => {
    const ts = new Date(2024, 5, 15, 14, 5, 6).getTime()
    const result = formatClockTime(ts, 'en-GB')
    // en-GB uses 24-hour format
    expect(result).toBe('14:05:06')
  })
})
