import { describe, expect, it } from 'vitest'

import { createPositionBounds } from './positionBounds'

describe('createPositionBounds', () => {
  it('returns the padded union of finite items from any iterable', () => {
    const items = new Set([
      { pos: [10, 20], size: [30, 40] },
      { pos: [-5, 50], size: [10, 15] }
    ])

    expect(createPositionBounds(items, 4)).toEqual([-9, 16, 53, 53])
  })

  it('ignores malformed geometry', () => {
    expect(
      createPositionBounds(
        [
          { pos: [Number.NaN, 0], size: [10, 10] },
          { pos: [1, 2], size: [3, 4] }
        ],
        0
      )
    ).toEqual([1, 2, 3, 4])
    expect(createPositionBounds([], Number.NaN)).toBeNull()
  })
})
