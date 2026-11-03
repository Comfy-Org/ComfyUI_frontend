import { describe, expect, it } from 'vitest'

import { isBoundsObject } from './geometry'

describe(isBoundsObject, () => {
  it.for([
    { value: { x: 1, y: 2, width: 3, height: 4 }, expected: true },
    { value: { x: 1, y: 2, width: 3 }, expected: false },
    { value: { x: '1', y: 2, width: 3, height: 4 }, expected: false },
    { value: null, expected: false },
    { value: 5, expected: false }
  ])('returns $expected for $value', ({ value, expected }) => {
    expect(isBoundsObject(value)).toBe(expected)
  })
})
