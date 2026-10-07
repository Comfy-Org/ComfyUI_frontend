import { describe, expect, it } from 'vitest'

import {
  canonicalWhenClause,
  isContextKeyName,
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
    },
    {
      source: 'My Ext.ready && !@scope/pkg.busy && 3d.open',
      expected: [
        { key: 'My Ext.ready', negated: false },
        { key: '@scope/pkg.busy', negated: true },
        { key: '3d.open', negated: false }
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
    { source: 'a == b', reason: 'comparison' },
    { source: 'a & b', reason: 'single ampersand' },
    { source: '   ', reason: 'whitespace only' }
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

describe('matchesContext with non-boolean values', () => {
  it.for([undefined, 0, 1, 'yes', null])(
    'matches neither "key" nor "!key" when the key is %s',
    (value) => {
      const context = { key: value } as unknown as Record<string, boolean>
      for (const source of ['key', '!key']) {
        const parsed = parseWhenClause(source)
        if (!parsed.success) throw new Error(parsed.error)
        expect(matchesContext(parsed.clause, context)).toBe(false)
      }
    }
  )
})

describe('isContextKeyName', () => {
  it.for([
    { name: 'modalOpen', expected: true },
    { name: 'My Ext.ready', expected: true },
    { name: '@scope/pkg.ready', expected: true },
    { name: '3d.ready', expected: true },
    { name: '!negated', expected: false },
    { name: 'a && b', expected: false },
    { name: ' padded', expected: false },
    { name: '', expected: false }
  ])('"$name" is referenceable: $expected', ({ name, expected }) => {
    expect(isContextKeyName(name)).toBe(expected)
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
