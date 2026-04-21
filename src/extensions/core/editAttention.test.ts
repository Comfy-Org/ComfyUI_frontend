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
  it.each([
    [
      'returns start and end of a simple parenthesized expression',
      '(cat)',
      2,
      { start: 1, end: 4 }
    ],
    [
      'finds enclosure when cursor is on opening paren',
      '(cat)',
      0,
      { start: 1, end: 4 }
    ],
    ['returns null when there are no parentheses', 'cat dog', 3, null],
    ['returns null when cursor is outside any enclosure', '(cat) dog', 7, null],
    [
      'finds the inner enclosure when cursor is on nested content',
      '(outer (inner) end)',
      9,
      { start: 8, end: 13 }
    ],
    [
      'finds the outer enclosure when cursor is on outer content',
      '(outer (inner) end)',
      2,
      { start: 1, end: 18 }
    ],
    ['returns null for empty string', '', 0, null],
    [
      'returns null when opening paren has no matching closing paren',
      '(cat',
      2,
      null
    ]
  ])('%s', (_, text, cursor, expected) => {
    expect(findNearestEnclosure(text, cursor)).toEqual(expected)
  })
})

describe('addWeightToParentheses', () => {
  it.each([
    ['adds weight 1.0 to a bare parenthesized token', '(cat)', '(cat:1.0)'],
    [
      'leaves a token that already has a weight unchanged',
      '(cat:1.5)',
      '(cat:1.5)'
    ],
    ['leaves a token without parentheses unchanged', 'cat', 'cat'],
    [
      'leaves a token with scientific notation weight unchanged',
      '(cat:1e-3)',
      '(cat:1e-3)'
    ],
    [
      'leaves a token with a negative weight unchanged',
      '(cat:-0.5)',
      '(cat:-0.5)'
    ],
    [
      'adds weight to a multi-word parenthesized token',
      '(cat dog)',
      '(cat dog:1.0)'
    ],
    [
      'adds weight when colon-number appears in content but no trailing weight exists',
      '(time 12:30)',
      '(time 12:30:1.0)'
    ]
  ])('%s', (_, input, expected) => {
    expect(addWeightToParentheses(input)).toBe(expected)
  })
})
