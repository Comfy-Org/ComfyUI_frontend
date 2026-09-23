import { describe, expect, it } from 'vitest'

import { validateLinkEndpoints } from './linkTuple'

/** A well-formed 6-element link tuple: [link_id, from, from_slot, to, to_slot, link_type]. */
const COMPLETE_TUPLE = ['1', 'node-a', 0, 'node-b', 1, 'IMAGE'] as const

describe('validateLinkEndpoints', () => {
  it('accepts a complete tuple with integer slots and a string type', () => {
    expect(validateLinkEndpoints(COMPLETE_TUPLE)).toEqual({
      originId: 'node-a',
      originSlot: 0,
      targetId: 'node-b',
      targetSlot: 1,
      type: 'IMAGE'
    })
  })

  it('rejects a five-element tuple: a partially landed write, never a deliberate wildcard', () => {
    // The applier only ever writes all 6 elements together (`connect`
    // rejects a non-string `link_type` before mset), so a missing element 5
    // must not be coerced to '*' and let an in-flight write prove delivery.
    const partiallyLanded = COMPLETE_TUPLE.slice(0, 5)
    expect(validateLinkEndpoints(partiallyLanded)).toBeNull()
  })

  it.for([
    {
      label: 'fractional origin slot',
      tuple: ['1', 'a', 0.5, 'b', 1, 'IMAGE']
    },
    {
      label: 'fractional target slot',
      tuple: ['1', 'a', 0, 'b', 1.5, 'IMAGE']
    },
    {
      label: 'non-finite origin slot',
      tuple: ['1', 'a', Infinity, 'b', 1, 'IMAGE']
    },
    { label: 'non-finite target slot', tuple: ['1', 'a', 0, 'b', NaN, 'IMAGE'] }
  ])('rejects a $label', ({ tuple }) => {
    expect(validateLinkEndpoints(tuple)).toBeNull()
  })

  it('rejects a non-string type instead of accepting it as delivery evidence', () => {
    const numericType = ['1', 'a', 0, 'b', 1, 7]
    expect(validateLinkEndpoints(numericType)).toBeNull()
  })

  it('rejects endpoint ids that are neither strings nor numbers', () => {
    const badOrigin = ['1', {}, 0, 'b', 1, 'IMAGE']
    expect(validateLinkEndpoints(badOrigin)).toBeNull()
  })
})
