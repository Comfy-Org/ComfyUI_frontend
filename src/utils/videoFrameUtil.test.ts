import { describe, expect, it } from 'vitest'

import { frameToTime, roundSeconds, timeToFrame } from '@/utils/videoFrameUtil'

describe('frameToTime', () => {
  it('maps frames proportionally across the duration', () => {
    expect(frameToTime(50, 10, 100)).toBe(5)
    expect(frameToTime(0, 10, 100)).toBe(0)
    expect(frameToTime(100, 10, 100)).toBe(10)
  })

  it('falls back to fps when duration is unknown', () => {
    expect(frameToTime(30, 0, 0, 30)).toBe(1)
  })

  it('returns 0 without duration or fallback fps', () => {
    expect(frameToTime(30, 0, 0)).toBe(0)
  })

  it('rejects non-positive or non-finite fallback fps', () => {
    expect(frameToTime(30, 0, 0, -30)).toBe(0)
    expect(frameToTime(30, 0, 0, 0)).toBe(0)
    expect(frameToTime(30, 0, 0, Infinity)).toBe(0)
  })
})

describe('timeToFrame', () => {
  it('maps time proportionally and rounds to whole frames', () => {
    expect(timeToFrame(5, 10, 100)).toBe(50)
    expect(timeToFrame(3.34, 10, 100)).toBe(33)
  })

  it('falls back to fps when duration is unknown', () => {
    expect(timeToFrame(1, 0, 0, 30)).toBe(30)
  })

  it('returns 0 without duration or fallback fps', () => {
    expect(timeToFrame(1, 0, 0)).toBe(0)
  })

  it('rejects non-positive or non-finite fallback fps', () => {
    expect(timeToFrame(1, 0, 0, -30)).toBe(0)
    expect(timeToFrame(1, 0, 0, Infinity)).toBe(0)
  })
})

describe('roundSeconds', () => {
  it('rounds to millisecond precision', () => {
    expect(roundSeconds(1.23456)).toBe(1.235)
    expect(roundSeconds(2)).toBe(2)
  })
})
