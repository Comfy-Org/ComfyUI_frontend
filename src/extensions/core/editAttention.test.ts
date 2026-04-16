import { describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: vi.fn(),
    ui: { settings: { addSetting: vi.fn() } }
  }
}))

import {
  addWeightToParentheses,
  findNearestEnclosure,
  incrementWeight
} from './editAttention'

describe('incrementWeight', () => {
  it('increments a weight by the given delta', () => {
    expect(incrementWeight('1.0', 0.05)).toBe('1.05')
  })

  it('decrements a weight by the given delta', () => {
    expect(incrementWeight('1.05', -0.05)).toBe('1')
  })

  it('returns the original string when weight is not a number', () => {
    expect(incrementWeight('abc', 0.05)).toBe('abc')
  })

  it('rounds correctly and avoids floating point accumulation', () => {
    expect(incrementWeight('1.1', 0.1)).toBe('1.2')
  })

  it('can produce a weight of zero', () => {
    expect(incrementWeight('0.05', -0.05)).toBe('0')
  })

  it('produces negative weights', () => {
    expect(incrementWeight('0.0', -0.05)).toBe('-0.05')
  })
})

describe('findNearestEnclosure', () => {
  it('returns start and end of a simple parenthesized expression', () => {
    expect(findNearestEnclosure('(cat)', 2)).toEqual({ start: 1, end: 4 })
  })

  it('returns null when there are no parentheses', () => {
    expect(findNearestEnclosure('cat dog', 3)).toBeNull()
  })

  it('returns null when cursor is outside any enclosure', () => {
    expect(findNearestEnclosure('(cat) dog', 7)).toBeNull()
  })

  it('finds the inner enclosure when cursor is on nested content', () => {
    expect(findNearestEnclosure('(outer (inner) end)', 9)).toEqual({
      start: 8,
      end: 13
    })
  })

  it('finds the outer enclosure when cursor is on outer content', () => {
    expect(findNearestEnclosure('(outer (inner) end)', 2)).toEqual({
      start: 1,
      end: 18
    })
  })

  it('returns null for empty string', () => {
    expect(findNearestEnclosure('', 0)).toBeNull()
  })

  it('returns null when opening paren has no matching closing paren', () => {
    expect(findNearestEnclosure('(cat', 2)).toBeNull()
  })
})

describe('addWeightToParentheses', () => {
  it('adds weight 1.0 to a bare parenthesized token', () => {
    expect(addWeightToParentheses('(cat)')).toBe('(cat:1.0)')
  })

  it('leaves a token that already has a weight unchanged', () => {
    expect(addWeightToParentheses('(cat:1.5)')).toBe('(cat:1.5)')
  })

  it('leaves a token without parentheses unchanged', () => {
    expect(addWeightToParentheses('cat')).toBe('cat')
  })

  it('leaves a token with scientific notation weight unchanged', () => {
    expect(addWeightToParentheses('(cat:1e-3)')).toBe('(cat:1e-3)')
  })

  it('leaves a token with a negative weight unchanged', () => {
    expect(addWeightToParentheses('(cat:-0.5)')).toBe('(cat:-0.5)')
  })

  it('adds weight to a multi-word parenthesized token', () => {
    expect(addWeightToParentheses('(cat dog)')).toBe('(cat dog:1.0)')
  })
})
