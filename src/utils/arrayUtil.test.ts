import { describe, expect, it, vi } from 'vitest'

import { findLast, findLastIndex } from './arrayUtil'

describe('findLastIndex', () => {
  it.for([
    { name: 'returns the last match', array: [1, 2, 3, 4], expected: 3 },
    { name: 'returns -1 with no match', array: [1, 1], expected: -1 },
    { name: 'returns -1 when empty', array: [], expected: -1 }
  ])('$name', ({ array, expected }) => {
    expect(findLastIndex(array, (value) => value % 2 === 0)).toBe(expected)
  })

  it('searches from the end and stops at the first match', () => {
    const predicate = vi.fn((value: number) => value === 2)
    expect(findLastIndex([1, 2, 3], predicate)).toBe(1)
    expect(predicate.mock.calls.map(([value]) => value)).toEqual([3, 2])
  })

  it('passes the index and the array to the predicate', () => {
    const array = ['a', 'b']
    const predicate = vi.fn(() => false)
    findLastIndex(array, predicate)
    expect(predicate.mock.calls).toEqual([
      ['b', 1, array],
      ['a', 0, array]
    ])
  })

  it('treats any truthy predicate result as a match', () => {
    expect(findLastIndex([0, 1, 0], (value) => value)).toBe(1)
  })
})

describe('findLast', () => {
  it('returns the last matching element', () => {
    expect(findLast([1, 2, 3, 4], (value) => value % 2 === 0)).toBe(4)
  })

  it('returns undefined with no match', () => {
    expect(findLast([1, 3], (value) => value % 2 === 0)).toBeUndefined()
  })

  it('returns undefined when empty', () => {
    expect(findLast([], () => true)).toBeUndefined()
  })

  it('distinguishes a matched falsy element from no match', () => {
    expect(findLast([0], (value) => value === 0)).toBe(0)
  })
})
