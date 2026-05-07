import { describe, expect, it } from 'vitest'

import { makeCompositeKey } from './compositeKey'

describe('makeCompositeKey', () => {
  it('produces a stable string for a tuple of values', () => {
    expect(makeCompositeKey(['a', 'b', 'c'])).toBe('["a","b","c"]')
  })

  it('distinguishes tuples whose joined parts collide', () => {
    // Without an injective encoding, ['ab', 'c'] and ['a', 'bc'] could collide.
    expect(makeCompositeKey(['ab', 'c'])).not.toBe(
      makeCompositeKey(['a', 'bc'])
    )
  })

  it('handles empty parts and undefined slots', () => {
    expect(makeCompositeKey(['x', '', 'y'])).toBe('["x","","y"]')
    expect(makeCompositeKey(['x', undefined, 'y'])).toBe('["x",null,"y"]')
  })

  it('preserves part order', () => {
    expect(makeCompositeKey(['1', '2'])).not.toBe(makeCompositeKey(['2', '1']))
  })
})
