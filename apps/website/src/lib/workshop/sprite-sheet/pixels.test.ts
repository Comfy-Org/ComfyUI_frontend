import { describe, expect, it } from 'vitest'

import type { Pixels } from './pixels'
import {
  inkOutline,
  opaqueBounds,
  pixelArt,
  posterize,
  toonShade
} from './pixels'

/** A `width` × `height` image, clear but for the opaque `solid` pixels. */
function pixels(
  width: number,
  height: number,
  solid: readonly [number, number][],
  rgb: readonly [number, number, number] = [200, 100, 50]
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of solid) data.set([...rgb, 255], (y * width + x) * 4)
  return { data, width, height }
}

const alphaAt = (image: Pixels, x: number, y: number) =>
  image.data[(y * image.width + x) * 4 + 3]

const pixelAt = (image: Pixels, x: number, y: number) => {
  const at = (y * image.width + x) * 4
  return Array.from(image.data.subarray(at, at + 4))
}

describe('posterize', () => {
  it.for([
    { value: 0, levels: 2, expected: 0 },
    { value: 120, levels: 2, expected: 0 },
    { value: 140, levels: 2, expected: 255 },
    { value: 100, levels: 3, expected: 128 }
  ])(
    'snaps $value to $levels levels as $expected',
    ({ value, levels, expected }) => {
      expect(posterize(value, levels)).toBe(expected)
    }
  )
})

describe('opaqueBounds', () => {
  it('boxes the opaque pixels of a cut-out character', () => {
    expect(
      opaqueBounds(
        pixels(6, 6, [
          [1, 2],
          [3, 4]
        ])
      )
    ).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 3
    })
  })

  it('takes the whole image when nothing is opaque', () => {
    expect(opaqueBounds(pixels(4, 3, []))).toEqual({
      x: 0,
      y: 0,
      width: 4,
      height: 3
    })
  })
})

describe('styles', () => {
  it.for([
    { name: 'pixel art', look: pixelArt },
    { name: 'toon shading', look: toonShade }
  ])('$name leaves every pixel opaque or clear', ({ look }) => {
    const image = pixels(2, 1, [[0, 0]])
    image.data[7] = 90
    const styled = look(image)
    expect([alphaAt(styled, 0, 0), alphaAt(styled, 1, 0)]).toEqual([255, 0])
  })

  it('pixel art keeps the source untouched', () => {
    const image = pixels(1, 1, [[0, 0]], [201, 99, 50])
    pixelArt(image)
    expect(pixelAt(image, 0, 0)).toEqual([201, 99, 50, 255])
  })
})

describe('inkOutline', () => {
  it('draws ink on the clear pixels around the character only', () => {
    const outlined = inkOutline(pixels(5, 5, [[2, 2]]), 1, [1, 2, 3])
    expect(pixelAt(outlined, 1, 2)).toEqual([1, 2, 3, 255])
    expect(alphaAt(outlined, 0, 0)).toBe(0)
    expect(pixelAt(outlined, 2, 2)).toEqual([200, 100, 50, 255])
  })
})
