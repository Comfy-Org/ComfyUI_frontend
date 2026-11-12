import { describe, expect, it } from 'vitest'

import { normalizeLightsValue } from './lightsValue'
import { createDefaultLight } from './types'

describe('normalizeLightsValue', () => {
  it('returns an empty list for non-array values', () => {
    expect(normalizeLightsValue(undefined)).toEqual([])
    expect(normalizeLightsValue('junk')).toEqual([])
    expect(normalizeLightsValue({})).toEqual([])
  })

  it('passes through a valid light unchanged', () => {
    const light = createDefaultLight('spot')
    expect(normalizeLightsValue([light])).toEqual([light])
  })

  it('drops entries with unknown or missing types', () => {
    const result = normalizeLightsValue([
      { type: 'laser' },
      null,
      'junk',
      createDefaultLight('point')
    ])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('point')
  })

  it('fills defaults for missing fields', () => {
    const [light] = normalizeLightsValue([{ type: 'directional' }])
    expect(light.color).toBe('#ffffff')
    expect(light.intensity).toBe(1.5)
    expect(light.target).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('rejects malformed colors and non-finite numbers', () => {
    const [light] = normalizeLightsValue([
      {
        type: 'directional',
        color: 'red',
        intensity: Number.NaN,
        position: { x: Number.POSITIVE_INFINITY, y: 1, z: 2 }
      }
    ])
    expect(light.color).toBe('#ffffff')
    expect(light.intensity).toBe(1.5)
    expect(light.position.x).toBe(0)
    expect(light.position.y).toBe(1)
  })

  it('strips target from point lights and range from directional lights', () => {
    const [point, directional] = normalizeLightsValue([
      { type: 'point', target: { x: 1, y: 1, z: 1 }, range: 5 },
      { type: 'directional', range: 5 }
    ])
    expect(point.target).toBeUndefined()
    expect(point.range).toBe(5)
    expect(directional.range).toBeUndefined()
  })

  it('omits zero range', () => {
    const [light] = normalizeLightsValue([{ type: 'point', range: 0 }])
    expect(light.range).toBeUndefined()
  })

  it.for([
    { inner: 12, outer: 20, expected: [12, 20] },
    { inner: 60, outer: 45, expected: [45, 45] },
    { inner: -5, outer: 45, expected: [0, 45] },
    { inner: 10, outer: -1, expected: [1, 1] },
    { inner: 30, outer: 120, expected: [30, 90] }
  ])(
    'normalizes spot cones inner=$inner outer=$outer',
    ({ inner, outer, expected }) => {
      const [light] = normalizeLightsValue([
        { type: 'spot', innerConeAngle: inner, outerConeAngle: outer }
      ])
      expect([light.innerConeAngle, light.outerConeAngle]).toEqual(expected)
    }
  )

  it.for([
    { label: 'a missing radius', radius: undefined, expected: 0.1 },
    { label: 'a zero radius', radius: 0, expected: 0 },
    { label: 'a negative radius', radius: -2, expected: 0 },
    { label: 'a positive radius', radius: 0.4, expected: 0.4 }
  ])(
    'normalizes $label on a point light to $expected',
    ({ radius, expected }) => {
      const [light] = normalizeLightsValue([{ type: 'point', radius }])
      expect(light.radius).toBe(expected)
    }
  )

  it('keeps a hard-shadow point light hard across repeated normalization', () => {
    const once = normalizeLightsValue([{ type: 'point', radius: 0 }])
    const [light] = normalizeLightsValue(normalizeLightsValue(once))
    expect(light.radius).toBe(0)
  })

  it.for([
    { color: '#abc', expected: '#abc' },
    { color: '#a1B2c3', expected: '#a1B2c3' },
    { color: '#1234', expected: '#ffffff' },
    { color: '#12345', expected: '#ffffff' },
    { color: '#1234567', expected: '#ffffff' },
    { color: '#12345678', expected: '#ffffff' },
    { color: '#ggg', expected: '#ffffff' }
  ])('normalizes color $color to $expected', ({ color, expected }) => {
    const [light] = normalizeLightsValue([{ type: 'point', color }])
    expect(light.color).toBe(expected)
  })

  it('keeps castShadow only when explicitly false', () => {
    const [off, on, absent] = normalizeLightsValue([
      { type: 'directional', castShadow: false },
      { type: 'directional', castShadow: true },
      { type: 'directional' }
    ])
    expect(off.castShadow).toBe(false)
    expect(on.castShadow).toBeUndefined()
    expect(absent.castShadow).toBeUndefined()
  })

  it('clamps negative intensity to zero', () => {
    const [light] = normalizeLightsValue([
      { type: 'directional', intensity: -2 }
    ])
    expect(light.intensity).toBe(0)
  })
})
