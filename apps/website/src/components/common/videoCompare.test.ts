import { describe, expect, it } from 'vitest'

import { positionFromPointer, stepPosition } from './videoCompare'

describe('positionFromPointer', () => {
  it.for([
    { clientX: 150, left: 100, width: 200, expected: 25 },
    { clientX: 100, left: 100, width: 200, expected: 0 },
    { clientX: 300, left: 100, width: 200, expected: 100 },
    { clientX: 20, left: 100, width: 200, expected: 0 },
    { clientX: 900, left: 100, width: 200, expected: 100 },
    { clientX: 50, left: 0, width: 0, expected: 0 }
  ])(
    'maps clientX $clientX in [$left, +$width] to $expected%',
    ({ clientX, left, width, expected }) => {
      expect(positionFromPointer(clientX, { left, width })).toBe(expected)
    }
  )
})

describe('stepPosition', () => {
  it.for([
    { current: 50, key: 'ArrowRight', shift: false, expected: 52 },
    { current: 50, key: 'ArrowUp', shift: false, expected: 52 },
    { current: 50, key: 'ArrowLeft', shift: false, expected: 48 },
    { current: 50, key: 'ArrowDown', shift: false, expected: 48 },
    { current: 50, key: 'ArrowRight', shift: true, expected: 60 },
    { current: 99, key: 'ArrowRight', shift: false, expected: 100 },
    { current: 1, key: 'ArrowLeft', shift: true, expected: 0 },
    { current: 50, key: 'Home', shift: false, expected: 0 },
    { current: 50, key: 'End', shift: false, expected: 100 },
    { current: 50, key: 'Enter', shift: false, expected: undefined }
  ])(
    '$key (shift=$shift) from $current gives $expected',
    ({ current, key, shift, expected }) => {
      expect(stepPosition(current, key, shift)).toBe(expected)
    }
  )
})
