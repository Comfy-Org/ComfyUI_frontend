import { describe, expect, it } from 'vitest'

import { gridFrames, pickCanvas, sourceFrames, swapSeconds } from './clip'

describe('gridFrames', () => {
  it.for<[number, number]>([
    [4.97, 124],
    [5, 124],
    [5.2, 141],
    [9.4, 226],
    [14.3, 345],
    [15, 345]
  ])(
    'generates the next 17k + 5 length for %f seconds: %i',
    ([seconds, frames]) => {
      expect(gridFrames(seconds)).toBe(frames)
      expect((frames - 5) % 17).toBe(0)
    }
  )

  it('never generates fewer frames than the part holds', () => {
    for (let seconds = 5; seconds <= 15; seconds += 0.37)
      expect(gridFrames(seconds)).toBeGreaterThanOrEqual(sourceFrames(seconds))
  })
})

describe('swapSeconds', () => {
  it('gives back the part chosen, up to the longest run', () => {
    expect(swapSeconds(5)).toBe(5)
    expect(swapSeconds(15)).toBe(345 / 24)
    expect(sourceFrames(15)).toBe(345)
  })
})

describe('pickCanvas', () => {
  it.for<[number, number, number, number]>([
    [1920, 1080, 1344, 768],
    [1080, 1920, 768, 1344],
    [1080, 1080, 768, 768],
    [1440, 1080, 1024, 768],
    [2560, 1080, 1536, 672]
  ])('gives a %ix%i source a %ix%i canvas', ([w, h, width, height]) => {
    expect(pickCanvas(w, h)).toEqual({ width, height })
  })
})
