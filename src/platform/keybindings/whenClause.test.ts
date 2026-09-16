import { describe, expect, it } from 'vitest'

import {
  canonicalWhenClause,
  matchesContext,
  parseWhenClause,
  whenClauseSpecificity
} from './whenClause'

describe('parseWhenClause', () => {
  it.for([
    { source: 'wasdMode', expected: [{ key: 'wasdMode', negated: false }] },
    {
      source: '!textInputFocus',
      expected: [{ key: 'textInputFocus', negated: true }]
    },
    {
      source: ' ext.wasd-mode &&  ! textInputFocus ',
      expected: [
        { key: 'ext.wasd-mode', negated: false },
        { key: 'textInputFocus', negated: true }
      ]
    }
  ])('parses "$source"', ({ source, expected }) => {
    expect(parseWhenClause(source)).toEqual({ success: true, clause: expected })
  })

  it.for([
    { source: '', reason: 'empty' },
    { source: 'a || b', reason: 'disjunction' },
    { source: '(a)', reason: 'parentheses' },
    { source: 'a &&', reason: 'trailing operator' },
    { source: 'a && a', reason: 'duplicate key' },
    { source: 'a == b', reason: 'comparison' }
  ])('rejects "$source" ($reason)', ({ source }) => {
    expect(parseWhenClause(source)).toMatchObject({
      success: false,
      error: expect.stringContaining('Invalid when clause')
    })
  })
})

describe('matchesContext', () => {
  const context = { wasdMode: true, textInputFocus: false }

  it.for([
    { source: 'wasdMode', expected: true },
    { source: '!wasdMode', expected: false },
    { source: 'wasdMode && !textInputFocus', expected: true },
    { source: 'wasdMode && textInputFocus', expected: false },
    { source: 'unregistered', expected: false },
    { source: '!unregistered', expected: false },
    { source: 'toString', expected: false },
    { source: '!toString', expected: false }
  ])('evaluates "$source"', ({ source, expected }) => {
    const parsed = parseWhenClause(source)
    if (!parsed.success) throw new Error(parsed.error)
    expect(matchesContext(parsed.clause, context)).toBe(expected)
  })
})

describe('canonicalWhenClause', () => {
  it('orders atoms so equal clauses spell the same', () => {
    expect(canonicalWhenClause('b && !a')).toBe('!a && b')
    expect(canonicalWhenClause(' !a&&b ')).toBe('!a && b')
  })

  it('keeps an unparseable clause as written', () => {
    expect(canonicalWhenClause(' a || b ')).toBe('a || b')
  })
})

describe('whenClauseSpecificity', () => {
  it.for([
    { source: undefined, expected: 0 },
    { source: 'a', expected: 1 },
    { source: 'a && !b', expected: 2 },
    { source: 'a || b', expected: 0 }
  ])('counts atoms in $source', ({ source, expected }) => {
    expect(whenClauseSpecificity(source)).toBe(expected)
  })
})
