import { describe, expect, it } from 'vitest'

import { formatDurationCompact, splitMinutes } from './formatDuration'

describe('formatDurationCompact', () => {
  it('keeps tenths of a second below a minute', () => {
    expect(formatDurationCompact(0)).toBe('0.0s')
    expect(formatDurationCompact(10_200)).toBe('10.2s')
    expect(formatDurationCompact(59_940)).toBe('59.9s')
  })

  it('switches to minutes at a minute', () => {
    expect(formatDurationCompact(60_000)).toBe('1m 0s')
    expect(formatDurationCompact(204_900)).toBe('3m 25s')
  })
})

describe('splitMinutes', () => {
  it('keeps counting minutes past the hour', () => {
    expect(splitMinutes(3_600_000)).toEqual({ minutes: 60, seconds: 0 })
  })
})
