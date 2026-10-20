import { describe, expect, it } from 'vitest'

import { clipAround } from '@e2e/fixtures/utils/boundsUtils'

describe('clipAround', () => {
  it('covers boxes and points together', () => {
    expect(
      clipAround([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 100, y: 5 }
      ])
    ).toEqual({ x: 10, y: 5, width: 90, height: 55 })
  })

  it('grows the covered rectangle by the margin on every side', () => {
    expect(clipAround([{ x: 50, y: 50, width: 10, height: 10 }], 5)).toEqual({
      x: 45,
      y: 45,
      width: 20,
      height: 20
    })
  })
})
