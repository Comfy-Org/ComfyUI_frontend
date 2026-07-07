import { describe, expect, it } from 'vitest'

import { commonType, isColorable, isNodeBindable } from './type'

describe('isColorable', () => {
  it.for<[string, unknown]>([
    ['a primitive', 42],
    ['null', null],
    ['an object without setColorOption', { getColorOption: () => null }],
    ['an object without getColorOption', { setColorOption: () => {} }]
  ])('returns false for %s', ([, value]) => {
    expect(isColorable(value)).toBe(false)
  })

  it('returns true for an object with both color option methods', () => {
    const colorable = {
      setColorOption: () => {},
      getColorOption: () => null
    }
    expect(isColorable(colorable)).toBe(true)
  })
})

describe('isNodeBindable', () => {
  it.for<[string, unknown]>([
    ['a primitive', 'widget'],
    ['null', null],
    ['an object without setNodeId', {}],
    ['an object with a non-function setNodeId', { setNodeId: true }]
  ])('returns false for %s', ([, value]) => {
    expect(isNodeBindable(value)).toBe(false)
  })

  it('returns true for an object with a setNodeId function', () => {
    expect(isNodeBindable({ setNodeId: () => {} })).toBe(true)
  })
})

describe('commonType', () => {
  it('returns undefined when any type is not a string', () => {
    expect(commonType('STRING', -1)).toBeUndefined()
  })

  it('returns the wildcard when all types are wildcards', () => {
    expect(commonType('*', '*')).toBe('*')
  })

  it('ignores wildcards when other types are present', () => {
    expect(commonType('*', 'STRING')).toBe('STRING')
  })

  it('returns the intersection of comma-delimited type lists', () => {
    expect(commonType('A,B', 'B,C')).toBe('B')
  })

  it('returns undefined when types do not intersect', () => {
    expect(commonType('A', 'B')).toBeUndefined()
  })
})
