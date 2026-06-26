import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dateKey,
  formatClockTime,
  formatShortMonthDay,
  isToday,
  isYesterday,
  parseIsoDateSafe
} from './dateTimeUtil'

const isoFractionalSecondsPattern = /\.(\d+)(?=Z|[+-]\d{2}:?\d{2}|$)/

function withStrictMillisecondParser<T>(
  run: (normalizedValues: string[]) => T
): T {
  const RealDate = Date
  const normalizedValues: string[] = []

  class StrictDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super()
        return
      }

      if (typeof value === 'string') {
        normalizedValues.push(value)
        const fractionalSeconds = value.match(isoFractionalSecondsPattern)?.[1]
        if (fractionalSeconds && fractionalSeconds.length !== 3) {
          super(Number.NaN)
          return
        }
      }

      super(value as string | number)
    }
  }

  vi.stubGlobal('Date', StrictDate as DateConstructor)

  try {
    return run(normalizedValues)
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('parseIsoDateSafe', () => {
  it('parses standard ISO 8601 with millisecond precision', () => {
    const date = parseIsoDateSafe('2026-04-18T10:04:55.651Z')
    expect(date?.toISOString()).toBe('2026-04-18T10:04:55.651Z')
  })

  it('normalizes fractional seconds longer than 3 digits', () => {
    withStrictMillisecondParser((normalizedValues) => {
      const date = parseIsoDateSafe('2026-04-18T10:04:55.6513Z')
      expect(date?.toISOString()).toBe('2026-04-18T10:04:55.651Z')
      expect(normalizedValues).toEqual(['2026-04-18T10:04:55.651Z'])
    })
  })

  it('handles fractional seconds without timezone suffix', () => {
    withStrictMillisecondParser((normalizedValues) => {
      const date = parseIsoDateSafe('2026-04-18T10:04:55.6513')
      expect(date).not.toBeNull()
      expect(Number.isNaN(date!.getTime())).toBe(false)
      expect(normalizedValues).toEqual(['2026-04-18T10:04:55.651'])
    })
  })

  it('handles offset timezones with long fractional seconds', () => {
    withStrictMillisecondParser((normalizedValues) => {
      const date = parseIsoDateSafe('2026-04-18T10:04:55.6513+09:00')
      expect(date?.toISOString()).toBe('2026-04-18T01:04:55.651Z')
      expect(normalizedValues).toEqual(['2026-04-18T10:04:55.651+09:00'])
    })
  })

  it('handles negative-offset timezones with long fractional seconds', () => {
    withStrictMillisecondParser((normalizedValues) => {
      const date = parseIsoDateSafe('2026-04-18T10:04:55.987654-05:00')
      expect(date?.toISOString()).toBe('2026-04-18T15:04:55.987Z')
      expect(normalizedValues).toEqual(['2026-04-18T10:04:55.987-05:00'])
    })
  })

  it('handles the full 9-digit nanosecond precision Go can emit', () => {
    withStrictMillisecondParser((normalizedValues) => {
      const date = parseIsoDateSafe('2026-04-18T10:04:55.123456789Z')
      expect(date?.toISOString()).toBe('2026-04-18T10:04:55.123Z')
      expect(normalizedValues).toEqual(['2026-04-18T10:04:55.123Z'])
    })
  })

  it('passes through timestamps without any fractional seconds', () => {
    const date = parseIsoDateSafe('2026-04-18T10:04:55Z')
    expect(date?.toISOString()).toBe('2026-04-18T10:04:55.000Z')
  })

  it('preserves an all-zero 3-digit fractional', () => {
    const date = parseIsoDateSafe('2026-04-18T10:04:55.000Z')
    expect(date?.toISOString()).toBe('2026-04-18T10:04:55.000Z')
  })

  it('normalizes 1- and 2-digit fractionals for strict parsers', () => {
    withStrictMillisecondParser((normalizedValues) => {
      expect(parseIsoDateSafe('2026-04-18T10:04:55.6Z')?.toISOString()).toBe(
        '2026-04-18T10:04:55.600Z'
      )
      expect(parseIsoDateSafe('2026-04-18T10:04:55.65Z')?.toISOString()).toBe(
        '2026-04-18T10:04:55.650Z'
      )

      expect(normalizedValues).toEqual([
        '2026-04-18T10:04:55.600Z',
        '2026-04-18T10:04:55.650Z'
      ])
    })
  })

  it('returns null for empty string', () => {
    expect(parseIsoDateSafe('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(parseIsoDateSafe(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseIsoDateSafe(undefined)).toBeNull()
  })

  it('returns null for unparseable input', () => {
    expect(parseIsoDateSafe('not-a-date')).toBeNull()
  })
})

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
