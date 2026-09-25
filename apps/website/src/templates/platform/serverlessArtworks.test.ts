import { describe, expect, it } from 'vitest'

import { ARTWORKS, inEllipse, inTriangle } from './serverlessArtworks'

const byId = Object.fromEntries(ARTWORKS.map((a) => [a.id, a.pixel]))

describe('serverlessArtworks', () => {
  it('exposes the four artworks in rotation order', () => {
    expect(ARTWORKS.map((a) => a.id)).toEqual([
      'anime',
      'dragon',
      'robot',
      'spacecraft'
    ])
  })

  it('keeps every intensity in the renderable 0..1 range', () => {
    for (const { pixel } of ARTWORKS) {
      for (let x = -1; x <= 1; x += 0.1) {
        for (let y = -1; y <= 1; y += 0.1) {
          const value = pixel(x, y)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('draws each subject brighter than the empty corners', () => {
    expect(byId.anime(0, 0)).toBeGreaterThan(0)
    expect(byId.dragon(0.62, -0.04)).toBe(1)
    expect(byId.robot(0, 0.11)).toBe(1)
    expect(byId.spacecraft(0.34, -0.01)).toBe(1)
    for (const { pixel } of ARTWORKS) {
      expect(pixel(-1, 1)).toBe(0)
      expect(pixel(1, 1)).toBe(0)
    }
  })

  it('punches out facial features as dark pixels', () => {
    expect(byId.anime(-0.13, -0.05)).toBe(0)
    expect(byId.anime(0.13, -0.05)).toBe(0)
    expect(byId.dragon(0.68, -0.09)).toBe(0)
  })

  it('tests points against ellipses and triangles', () => {
    expect(inEllipse(0, 0, 0, 0, 1, 1)).toBe(true)
    expect(inEllipse(2, 0, 0, 0, 1, 1)).toBe(false)
    const a = { x: 0, y: 0 }
    const b = { x: 1, y: 0 }
    const c = { x: 0, y: 1 }
    expect(inTriangle(0.2, 0.2, a, b, c)).toBe(true)
    expect(inTriangle(0.9, 0.9, a, b, c)).toBe(false)
  })
})
