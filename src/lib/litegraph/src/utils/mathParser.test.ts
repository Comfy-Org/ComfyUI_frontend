import { describe, expect, test } from 'vitest'

import { evaluateMathExpression } from '@/lib/litegraph/src/utils/mathParser'

describe('evaluateMathExpression', () => {
  test.each([
    ['2+3', 5],
    ['10-4', 6],
    ['3*7', 21],
    ['15/3', 5]
  ])('basic arithmetic: %s = %d', (input, expected) => {
    expect(evaluateMathExpression(input)).toBe(expected)
  })

  test.each([
    ['2+3*4', 14],
    ['(2+3)*4', 20],
    ['10-2*3', 4],
    ['10/2+3', 8]
  ])('operator precedence: %s = %d', (input, expected) => {
    expect(evaluateMathExpression(input)).toBe(expected)
  })

  test.each([
    ['3.14*2', 6.28],
    ['.5+.5', 1],
    ['1.5+2.5', 4],
    ['0.1+0.2', 0.1 + 0.2],
    ['123.', 123],
    ['123.+3', 126]
  ])('decimals: %s', (input, expected) => {
    expect(evaluateMathExpression(input)).toBe(expected)
  })

  test.each([
    [' 2 + 3 ', 5],
    ['  10  -  4  ', 6],
    [' ( 2 + 3 ) * 4 ', 20]
  ])('whitespace handling: "%s" = %d', (input, expected) => {
    expect(evaluateMathExpression(input)).toBe(expected)
  })

  test.each([
    ['((2+3))', 5],
    ['(1+(2*(3+4)))', 15],
    ['((1+2)*(3+4))', 21]
  ])('nested parentheses: %s = %d', (input, expected) => {
    expect(evaluateMathExpression(input)).toBe(expected)
  })

  test.each([
    ['-5', -5],
    ['-(3+2)', -5],
    ['--5', 5],
    ['+5', 5],
    ['-3*2', -6],
    ['2*-3', -6],
    ['1+-2', -1],
    ['2--3', 5],
    ['-2*-3', 6],
    ['-(2+3)*-(4+5)', 45]
  ])('unary operators: %s = %d', (input, expected) => {
    expect(evaluateMathExpression(input)).toBe(expected)
  })

  test.each([
    ['2 /2+3 * 4.75- -6', 21.25],
    ['2 / (2 + 3) * 4.33 - -6', 7.732],
    ['12* 123/-(-5 + 2)', 492],
    ['((80 - (19)))', 61],
    ['(1 - 2) + -(-(-(-4)))', 3],
    ['1 - -(-(-(-4)))', -3],
    ['12* 123/(-5 + 2)', -492],
    ['12 * -123', -1476],
    ['((2.33 / (2.9+3.5)*4) - -6)', 7.45625],
    ['123.45*(678.90 / (-2.5+ 11.5)-(80 -19) *33.25) / 20 + 11', -12042.760875],
    [
      '(123.45*(678.90 / (-2.5+ 11.5)-(((80 -(19))) *33.25)) / 20) - (123.45*(678.90 / (-2.5+ 11.5)-(((80 -(19))) *33.25)) / 20) + (13 - 2)/ -(-11) ',
      1
    ]
  ])('complex expression: %s', (input, expected) => {
    expect(evaluateMathExpression(input)).toBeCloseTo(expected as number)
  })

  test.each(['', 'abc', '2+', '(2+3', '2+3)', '()', '*3', '2 3', '.', '123..'])(
    'invalid input returns undefined: "%s"',
    (input) => {
      expect(evaluateMathExpression(input)).toBeUndefined()
    }
  )

  test('division by zero returns Infinity', () => {
    expect(evaluateMathExpression('1/0')).toBe(Infinity)
  })

  test('0/0 returns NaN', () => {
    expect(evaluateMathExpression('0/0')).toBeNaN()
  })

  test.each([
    ['10%3', 1],
    ['10%3+1', 2],
    ['7%2', 1]
  ])('modulo: %s = %d', (input, expected) => {
    expect(evaluateMathExpression(input)).toBe(expected)
  })

  test('negative zero is normalized to positive zero', () => {
    expect(Object.is(evaluateMathExpression('-0'), 0)).toBe(true)
  })

  test('deeply nested parentheses exceeding depth limit returns undefined', () => {
    const input = '('.repeat(201) + '1' + ')'.repeat(201)
    expect(evaluateMathExpression(input)).toBeUndefined()
  })

  test('parentheses within depth limit evaluate correctly', () => {
    const input = '('.repeat(200) + '1' + ')'.repeat(200)
    expect(evaluateMathExpression(input)).toBe(1)
  })
})
