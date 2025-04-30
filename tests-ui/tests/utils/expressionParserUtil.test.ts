import { describe, expect, it } from 'vitest'

import {
  ContextValue,
  evaluateExpression,
  parseAST,
  tokenize
} from '@/utils/expressionParserUtil'

describe('tokenize()', () => {
  it('splits identifiers, literals, operators and parentheses', () => {
    const tokens = tokenize('a && !b || (c == "d")')
    expect(tokens.map((t) => t.t)).toEqual([
      'a',
      '&&',
      '!',
      'b',
      '||',
      '(',
      'c',
      '==',
      '"d"',
      ')'
    ])
  })

  it('throws on encountering invalid characters', () => {
    expect(() => tokenize('a & b')).toThrowError(/Invalid character/)
  })
})

describe('parseAST()', () => {
  it('parses a single identifier', () => {
    const ast = parseAST(tokenize('x'))
    expect(ast).toEqual({ type: 'Identifier', name: 'x' })
  })

  it('respects default precedence (&& over ||)', () => {
    const ast = parseAST(tokenize('a || b && c'))
    expect(ast).toEqual({
      type: 'Binary',
      op: '||',
      left: { type: 'Identifier', name: 'a' },
      right: {
        type: 'Binary',
        op: '&&',
        left: { type: 'Identifier', name: 'b' },
        right: { type: 'Identifier', name: 'c' }
      }
    })
  })

  it('honors parentheses to override precedence', () => {
    const ast = parseAST(tokenize('(a || b) && c'))
    expect(ast).toEqual({
      type: 'Binary',
      op: '&&',
      left: {
        type: 'Binary',
        op: '||',
        left: { type: 'Identifier', name: 'a' },
        right: { type: 'Identifier', name: 'b' }
      },
      right: { type: 'Identifier', name: 'c' }
    })
  })

  it('parses unary NOT correctly', () => {
    const ast = parseAST(tokenize('!a && b'))
    expect(ast).toEqual({
      type: 'Binary',
      op: '&&',
      left: { type: 'Unary', op: '!', arg: { type: 'Identifier', name: 'a' } },
      right: { type: 'Identifier', name: 'b' }
    })
  })
})

describe('evaluateExpression()', () => {
  const context: Record<string, ContextValue> = {
    a: true,
    b: false,
    c: true,
    d: '',
    num1: 1,
    num0: 0
  }
  const getContextKey = (key: string) => context[key]

  it('returns true for empty expression', () => {
    expect(evaluateExpression('', getContextKey)).toBe(true)
  })

  it('evaluates literals and basic comparisons', () => {
    expect(evaluateExpression('"hi"', getContextKey)).toBe(true)
    expect(evaluateExpression("''", getContextKey)).toBe(false)
    expect(evaluateExpression('1', getContextKey)).toBe(true)
    expect(evaluateExpression('0', getContextKey)).toBe(false)
    expect(evaluateExpression('1 == 1', getContextKey)).toBe(true)
    expect(evaluateExpression('1 != 2', getContextKey)).toBe(true)
    expect(evaluateExpression("'x' == 'y'", getContextKey)).toBe(false)
  })

  it('evaluates logical AND, OR and NOT', () => {
    expect(evaluateExpression('a && b', getContextKey)).toBe(false)
    expect(evaluateExpression('a || b', getContextKey)).toBe(true)
    expect(evaluateExpression('!b', getContextKey)).toBe(true)
  })

  it('respects operator precedence and parentheses', () => {
    expect(evaluateExpression('a || b && c', getContextKey)).toBe(true)
    expect(evaluateExpression('(a || b) && c', getContextKey)).toBe(true)
    expect(evaluateExpression('!(a && b) || c', getContextKey)).toBe(true)
  })

  it('safely handles syntax errors by returning false', () => {
    expect(evaluateExpression('a &&', getContextKey)).toBe(false)
    expect(evaluateExpression('foo $ bar', getContextKey)).toBe(false)
  })
})
