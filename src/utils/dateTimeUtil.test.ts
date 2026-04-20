import { describe, expect, it, vi } from 'vitest'

import { parseIsoDateSafe } from './dateTimeUtil'

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
    const date = parseIsoDateSafe('2026-04-18T10:04:55.6513Z')
    expect(date?.toISOString()).toBe('2026-04-18T10:04:55.651Z')
  })

  it('handles fractional seconds without timezone suffix', () => {
    const date = parseIsoDateSafe('2026-04-18T10:04:55.6513')
    expect(date).not.toBeNull()
    expect(Number.isNaN(date!.getTime())).toBe(false)
  })

  it('handles offset timezones with long fractional seconds', () => {
    const date = parseIsoDateSafe('2026-04-18T10:04:55.6513+09:00')
    expect(date?.toISOString()).toBe('2026-04-18T01:04:55.651Z')
  })

  it('handles negative-offset timezones with long fractional seconds', () => {
    const date = parseIsoDateSafe('2026-04-18T10:04:55.987654-05:00')
    expect(date?.toISOString()).toBe('2026-04-18T15:04:55.987Z')
  })

  it('handles the full 9-digit nanosecond precision Go can emit', () => {
    const date = parseIsoDateSafe('2026-04-18T10:04:55.123456789Z')
    expect(date?.toISOString()).toBe('2026-04-18T10:04:55.123Z')
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
