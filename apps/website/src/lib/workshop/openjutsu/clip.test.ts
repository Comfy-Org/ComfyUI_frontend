import { describe, expect, it } from 'vitest'

import { gridFrames, pickCanvas } from './clip'

describe('gridFrames', () => {
  it.for<[number, number]>([
    [4.97, 107],
    [5, 107],
    [5.2, 124],
    [10, 226],
    [14.4, 345],
    [15, 345]
  ])('fits %f seconds into %i frames of 17k + 5', ([seconds, frames]) => {
    expect(gridFrames(seconds)).toBe(frames)
    expect((frames - 5) % 17).toBe(0)
  })

  it('never asks for more frames than the seconds hold', () => {
    for (let seconds = 5; seconds <= 15; seconds += 0.37)
      expect(gridFrames(seconds) / 24).toBeLessThanOrEqual(seconds + 1e-6)
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
