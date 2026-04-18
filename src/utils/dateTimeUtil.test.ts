import { describe, expect, it } from 'vitest'

import { parseIsoDateSafe } from './dateTimeUtil'

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

  it('leaves 1- and 2-digit fractionals untouched', () => {
    expect(parseIsoDateSafe('2026-04-18T10:04:55.6Z')?.toISOString()).toBe(
      '2026-04-18T10:04:55.600Z'
    )
    expect(parseIsoDateSafe('2026-04-18T10:04:55.65Z')?.toISOString()).toBe(
      '2026-04-18T10:04:55.650Z'
    )
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
