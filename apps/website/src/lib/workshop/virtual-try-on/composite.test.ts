import { describe, expect, it } from 'vitest'

import { dressPixels } from './composite'

const pixels = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat())
const opaque = [0, 0, 0, 255]
const clear = [0, 0, 0, 0]

describe('dressPixels', () => {
  it('leaves the photo alone outside the mask', () => {
    const person = pixels([10, 20, 30, 255], [200, 100, 50, 255])
    const fabric = pixels([255, 0, 0, 255], [255, 0, 0, 255])

    const out = dressPixels(
      person,
      fabric,
      pixels(opaque, clear),
      pixels(opaque, clear)
    )

    expect(Array.from(out.slice(4))).toEqual([200, 100, 50, 255])
  })

  it('shades the fabric by the photo, brighter where the photo is brighter', () => {
    const person = pixels([60, 60, 60, 255], [180, 180, 180, 255])
    const fabric = pixels([200, 200, 200, 255], [200, 200, 200, 255])

    const out = dressPixels(
      person,
      fabric,
      pixels(opaque, opaque),
      pixels(opaque, opaque)
    )

    expect(out[0]).toBeLessThan(out[4])
    expect(out[4]).toBeLessThanOrEqual(255)
    expect(out[3]).toBe(255)
  })

  it('darkens the fabric towards the edge of the garment', () => {
    const person = pixels([120, 120, 120, 255], [120, 120, 120, 255])
    const fabric = pixels([200, 200, 200, 255], [200, 200, 200, 255])

    const out = dressPixels(
      person,
      fabric,
      pixels(opaque, opaque),
      pixels(opaque, [0, 0, 0, 60])
    )

    expect(out[4]).toBeLessThan(out[0])
  })

  it('returns a copy of the photo when the mask is empty', () => {
    const person = pixels([1, 2, 3, 255])
    const out = dressPixels(
      person,
      pixels(opaque),
      pixels(clear),
      pixels(clear)
    )
    expect([...out]).toEqual([1, 2, 3, 255])
    expect(out).not.toBe(person)
  })
})
