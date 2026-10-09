import { describe, expect, it } from 'vitest'

import { clearWhiteBackdrop } from './cutout'

function pixels(colors: readonly (readonly number[])[]) {
  return new Uint8ClampedArray(colors.flat())
}

const WHITE = [255, 255, 255, 255]
const RED = [200, 30, 20, 255]
const CLEAR = [0, 0, 0, 0]

describe('clearWhiteBackdrop', () => {
  it('clears a white backdrop and keeps the product', () => {
    const data = pixels([WHITE, RED, WHITE, WHITE, WHITE, WHITE])
    expect(clearWhiteBackdrop(data, 3, 2)).toBe(true)
    expect(Array.from(data.filter((_, index) => index % 4 === 3))).toEqual([
      0, 255, 0, 0, 0, 0
    ])
  })

  it.for([
    { name: 'a cut-out with clear corners', corner: CLEAR },
    { name: 'a photo with a dark corner', corner: RED }
  ])('leaves $name alone', ({ corner }) => {
    const data = pixels([corner, WHITE, WHITE, WHITE])
    const before = Array.from(data)
    expect(clearWhiteBackdrop(data, 2, 2)).toBe(false)
    expect(Array.from(data)).toEqual(before)
  })
})
