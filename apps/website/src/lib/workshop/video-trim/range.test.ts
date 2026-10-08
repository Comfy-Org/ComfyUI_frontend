import { describe, expect, it } from 'vitest'

import {
  initialTrim,
  tooShortToTrim,
  trimEndTo,
  trimLength,
  trimSlideTo,
  trimStartTo
} from './range'

const limits = { min: 5, max: 15 }

describe('tooShortToTrim', () => {
  it.for<[number, boolean]>([
    [2, true],
    [4.9, true],
    [4.97, false],
    [5, false],
    [40, false]
  ])('says whether a %f second video is too short: %s', ([seconds, short]) => {
    expect(tooShortToTrim(seconds, limits)).toBe(short)
  })
})

describe('initialTrim', () => {
  it('takes the whole of a video inside the limits', () => {
    expect(initialTrim(9, limits)).toEqual({ start: 0, end: 9 })
  })

  it('takes the first maximum of a longer video', () => {
    expect(initialTrim(42, limits)).toEqual({ start: 0, end: 15 })
  })

  it('takes all of a video a rounding short of the minimum', () => {
    expect(initialTrim(4.97, limits)).toEqual({ start: 0, end: 4.97 })
  })

  it('reopens on the range chosen before, if it still fits', () => {
    const chosen = { start: 3, end: 11 }
    expect(initialTrim(42, limits, chosen)).toEqual(chosen)
    expect(initialTrim(8, limits, chosen)).toEqual({ start: 0, end: 8 })
  })
})

describe('dragging the handles', () => {
  const range = { start: 10, end: 20 }

  it('stops the start a minimum length before the end', () => {
    expect(trimStartTo(range, 19, 60, limits)).toEqual({ start: 15, end: 20 })
  })

  it('brings the end along when the start is pulled past the maximum', () => {
    expect(trimStartTo(range, 1, 60, limits)).toEqual({ start: 1, end: 16 })
  })

  it('stops the end a minimum length after the start', () => {
    expect(trimEndTo(range, 11, 60, limits)).toEqual({ start: 10, end: 15 })
  })

  it('brings the start along when the end is pulled past the maximum', () => {
    expect(trimEndTo(range, 40, 60, limits)).toEqual({ start: 25, end: 40 })
  })

  it('keeps both handles inside the video', () => {
    expect(trimStartTo(range, -5, 60, limits)).toEqual({ start: 0, end: 15 })
    expect(trimEndTo(range, 99, 22, limits)).toEqual({ start: 10, end: 22 })
  })

  it('never leaves a length outside the limits', () => {
    for (let time = -5; time <= 65; time += 1.3) {
      for (const next of [
        trimStartTo(range, time, 60, limits),
        trimEndTo(range, time, 60, limits)
      ]) {
        expect(trimLength(next)).toBeGreaterThanOrEqual(5 - 1e-9)
        expect(trimLength(next)).toBeLessThanOrEqual(15 + 1e-9)
      }
    }
  })
})

describe('trimSlideTo', () => {
  it('moves the range without changing its length, inside the video', () => {
    const range = { start: 10, end: 20 }
    expect(trimSlideTo(range, 30, 60)).toEqual({ start: 30, end: 40 })
    expect(trimSlideTo(range, 58, 60)).toEqual({ start: 50, end: 60 })
    expect(trimSlideTo(range, -4, 60)).toEqual({ start: 0, end: 10 })
  })
})
