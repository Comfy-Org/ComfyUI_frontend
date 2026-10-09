import { describe, expect, it } from 'vitest'

import { nextFrameRate } from './options'

describe('nextFrameRate', () => {
  it('steps up through the rates and wraps round', () => {
    expect([nextFrameRate(6), nextFrameRate(8), nextFrameRate(12)]).toEqual([
      8, 12, 6
    ])
  })
})
