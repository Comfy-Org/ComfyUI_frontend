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
      const count = 50_000

      for (let i = 0; i < count; i++) {
        expect(set.add(i, i * 31, 5)).toBe(i)
      }

      expect(set.size).toBe(count)
      for (let i = 0; i < count; i += 997) {
        expect(set.add(i, i * 31, 5)).toBe(i)
      }
      expect(set.size).toBe(count)
    }
  )
})
