import { describe, expect, it } from 'vitest'

import type { SwapSize } from './clip'
import { SWAP_SIZES, resultSize, swapCanvas, swapSeconds } from './clip'

describe('swapSeconds', () => {
  it('gives back the part chosen, up to the longest part', () => {
    expect(swapSeconds(5)).toBe(5)
    expect(swapSeconds(9.4)).toBe(9.4)
    expect(swapSeconds(15)).toBe(15)
    expect(swapSeconds(20)).toBe(15)
  })
})

describe('swapCanvas', () => {
  it.for<[number, number, SwapSize, number, number]>([
    [1920, 1080, '768p', 1344, 768],
    [1080, 1920, '768p', 768, 1344],
    [1920, 1080, '480p', 864, 480],
    [1080, 1080, '768p', 1024, 1024],
    [600, 1066, '480p', 480, 864],
    [1440, 1080, '768p', 1184, 864]
  ])(
    'gives a %ix%i source at %s a %ix%i canvas',
    ([w, h, size, width, height]) => {
      expect(swapCanvas(w, h, size)).toEqual({ width, height })
    }
  )

  it('keeps every side a multiple of 32 and the pixels near the budget', () => {
    for (const [w, h] of [
      [1920, 800],
      [720, 1280],
      [1000, 1000],
      [2560, 1080],
      [640, 480]
    ]) {
      const canvas = swapCanvas(w, h, '768p')
      expect(canvas.width % 32).toBe(0)
      expect(canvas.height % 32).toBe(0)
      expect((canvas.width * canvas.height) / (1344 * 768)).toBeCloseTo(1, 0)
    }
  })
})

describe('resultSize', () => {
  it.for<[number, number]>([
    [1920, 1080],
    [1080, 1920],
    [1920, 800],
    [600, 1066],
    [1000, 1000],
    [2560, 1080]
  ])('saves a %ix%i source in its own shape', ([w, h]) => {
    for (const size of SWAP_SIZES) {
      const canvas = swapCanvas(w, h, size)
      const saved = resultSize(w, h, canvas)
      expect(saved.width).toBeLessThanOrEqual(canvas.width)
      expect(saved.height).toBeLessThanOrEqual(canvas.height)
      expect(saved.width % 2).toBe(0)
      expect(saved.height % 2).toBe(0)
      // within one pixel row or column of the source's exact shape
      expect(Math.abs(saved.width / saved.height - w / h)).toBeLessThan(
        (2 * (w / h)) / saved.height + 2 / saved.height
      )
    }
  })
})
