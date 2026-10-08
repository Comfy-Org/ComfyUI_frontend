import { describe, expect, it } from 'vitest'

import { factsOf, tileSize, tileTimes } from './filmstrip'

describe('factsOf', () => {
  it('reads length and frame size from a loaded video', () => {
    expect(
      factsOf({ duration: 9.5, videoWidth: 1920, videoHeight: 1080 })
    ).toEqual({ duration: 9.5, width: 1920, height: 1080 })
  })

  it.for<[string, number, number]>([
    ['a stream with no known length', Infinity, 1920],
    ['a file whose length is unreadable', NaN, 1920],
    ['an empty file', 0, 1920],
    ['a file with sound but no picture', 9.5, 0]
  ])('rejects %s', ([, duration, videoWidth]) => {
    expect(factsOf({ duration, videoWidth, videoHeight: 1080 })).toBeUndefined()
  })
})

describe('tileTimes', () => {
  it('takes the middle of each equal share of the video', () => {
    expect(tileTimes(4, 20)).toEqual([2.5, 7.5, 12.5, 17.5])
  })

  it('never lands on the very end, where a seek may not settle', () => {
    expect(Math.max(...tileTimes(14, 30))).toBeLessThan(30)
  })
})

describe('tileSize', () => {
  it.for<[number, number, number]>([
    [1920, 1080, 171],
    [1080, 1920, 54],
    [1000, 1000, 96]
  ])(
    'keeps a %ix%i video in shape at a fixed height',
    ([width, height, tile]) => {
      expect(tileSize({ duration: 5, width, height })).toEqual({
        width: tile,
        height: 96
      })
    }
  )
})
