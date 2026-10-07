import { describe, expect, it } from 'vitest'

import {
  clipFits,
  defaultWindow,
  fitWindow,
  gridFrames,
  pickCanvas
} from './clip'

describe('clipFits', () => {
  it.for<[number, boolean]>([
    [4.5, false],
    [4.97, true],
    [5, true],
    [15, true],
    [15.04, true],
    [15.5, false],
    [30, false]
  ])('says whether a %f second clip may be used: %s', ([seconds, fits]) => {
    expect(clipFits(seconds)).toBe(fits)
  })
})

describe('gridFrames', () => {
  it.for<[number, number]>([
    [3.1, 73],
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
    for (let seconds = 4; seconds <= 15; seconds += 0.37)
      expect(gridFrames(seconds) / 24).toBeLessThanOrEqual(seconds + 1e-6)
  })
})

describe('fitWindow', () => {
  it('starts a new clip on its first five seconds or so', () => {
    expect(defaultWindow(12)).toEqual({ start: 0, seconds: 124 / 24 })
  })

  it('takes all it can of a clip barely five seconds long', () => {
    expect(defaultWindow(5.1)).toEqual({ start: 0, seconds: 107 / 24 })
  })

  it('snaps a dragged length to one the model can run', () => {
    const fitted = fitWindow({ start: 1, seconds: 7.9 }, 12)
    expect(fitted.seconds * 24).toBe(192)
    expect(fitted.start).toBe(1)
  })

  it('pulls a window back inside the clip', () => {
    const fitted = fitWindow({ start: 11, seconds: 5 }, 12)
    expect(fitted.start + fitted.seconds).toBeCloseTo(12)
  })

  it('stops at the longest and shortest swap', () => {
    expect(fitWindow({ start: 0, seconds: 40 }, 15).seconds).toBe(345 / 24)
    expect(fitWindow({ start: 0, seconds: 0.2 }, 15).seconds).toBe(73 / 24)
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
