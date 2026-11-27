import { describe, expect, it } from 'vitest'

import { createTupleSet } from './tupleSet'

describe('createTupleSet', () => {
  it('numbers new tuples in insertion order', () => {
    const set = createTupleSet(2)

    expect(set.add(7, 9)).toBe(0)
    expect(set.add(9, 7)).toBe(1)
    expect(set.add(0, 0)).toBe(2)
    expect(set.size).toBe(3)
  })

  it('returns the original number for a repeated tuple', () => {
    const set = createTupleSet(3)
    set.add(1, 2, 3)
    set.add(4, 5, 6)

    expect(set.add(1, 2, 3)).toBe(0)
    expect(set.add(4, 5, 6)).toBe(1)
    expect(set.size).toBe(2)
  })

  it('tells triples apart by their third value', () => {
    const set = createTupleSet(3)

    expect(set.add(1, 2, 3)).toBe(0)
    expect(set.add(1, 2, 4)).toBe(1)
    expect(set.add(1, 2, 0)).toBe(2)
  })

  it('keeps full 32-bit values distinct', () => {
    const set = createTupleSet(2)

    expect(set.add(0xffffffff, 0)).toBe(0)
    expect(set.add(0x7fffffff, 0)).toBe(1)
    expect(set.add(0xffffffff, 0)).toBe(0)
  })

  it('ignores a third value on pairs', () => {
    const set = createTupleSet(2)

    expect(set.add(1, 2, 3)).toBe(0)
    expect(set.add(1, 2, 4)).toBe(0)
    expect(set.size).toBe(1)
  })

  it.for([2, 3] as const)(
    'keeps every number stable while growing with width %i',
    (width) => {
      const set = createTupleSet(width)
      const tuples = Array.from(
        { length: 50_000 },
        (_, i) => [i, i * 31, 5] as const
      )
      const repeated = tuples.filter(([a]) => a % 997 === 0)

      const firstOrdinals = tuples.map((tuple) => set.add(...tuple))
      const repeatedOrdinals = repeated.map((tuple) => set.add(...tuple))

      expect(firstOrdinals).toEqual(tuples.map(([a]) => a))
      expect(repeatedOrdinals).toEqual(repeated.map(([a]) => a))
      expect(set.size).toBe(tuples.length)
    }
  )
})
