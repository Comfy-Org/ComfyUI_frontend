import { describe, expect, it } from 'vitest'

import {
  parseAmountInput,
  parseWholeNumber
} from '@/platform/workspace/components/dialogs/autoReloadNumberInput'

const INVALID = { value: 0, invalid: true }

describe('parseWholeNumber', () => {
  it.for([
    { case: 'empty input', locale: 'en', raw: '', expected: 0 },
    { case: 'whitespace only', locale: 'en', raw: '   ', expected: 0 },
    { case: 'plain digits', locale: 'en', raw: '5000', expected: 5000 },
    { case: 'surrounding spaces', locale: 'en', raw: ' 42 ', expected: 42 },
    { case: 'zero', locale: 'en', raw: '0', expected: 0 },
    { case: 'canonical grouping', locale: 'en', raw: '5,000', expected: 5000 },
    {
      case: 'canonical dot grouping',
      locale: 'pt-BR',
      raw: '5.000',
      expected: 5000
    },
    {
      case: 'localized non-Latin digits',
      locale: 'fa',
      raw: '۱٬۰۵۵',
      expected: 1055
    },
    {
      case: 'largest safe integer',
      locale: 'en',
      raw: String(Number.MAX_SAFE_INTEGER),
      expected: Number.MAX_SAFE_INTEGER
    }
  ])('accepts $case', ({ locale, raw, expected }) => {
    expect(parseWholeNumber(raw, locale)).toEqual({
      value: expected,
      invalid: false
    })
  })

  it.for([
    { case: 'a negative number', locale: 'en', raw: '-10' },
    { case: 'embedded letters', locale: 'en', raw: '1abc2' },
    { case: 'exponent notation', locale: 'en', raw: '1e3' },
    { case: 'a decimal', locale: 'en', raw: '5.49' },
    { case: 'non-canonical grouping', locale: 'en', raw: '5,00' },
    { case: 'non-canonical dot grouping', locale: 'pt-BR', raw: '5.00' },
    {
      case: 'an unsafe integer',
      locale: 'en',
      raw: String(Number.MAX_SAFE_INTEGER + 2)
    }
  ])('rejects $case', ({ locale, raw }) => {
    expect(parseWholeNumber(raw, locale)).toEqual(INVALID)
  })
})

describe('parseAmountInput', () => {
  it.for([
    {
      case: 'converts a valid amount',
      raw: '10',
      convert: (value: number) => value * 100,
      expected: { value: 1000, invalid: false }
    },
    {
      case: 'keeps empty input valid at zero',
      raw: '',
      convert: (value: number) => value * 100,
      expected: { value: 0, invalid: false }
    },
    {
      case: 'passes a parse failure through without converting',
      raw: '1abc2',
      convert: () => 1,
      expected: INVALID
    },
    {
      case: 'rejects a conversion that overflows safe integers',
      raw: String(Number.MAX_SAFE_INTEGER),
      convert: (value: number) => value * 100,
      expected: INVALID
    },
    {
      case: 'rejects a fractional conversion',
      raw: '1',
      convert: (value: number) => value / 3,
      expected: INVALID
    },
    {
      case: 'rejects a negative conversion',
      raw: '1',
      convert: (value: number) => -value,
      expected: INVALID
    }
  ])('$case', ({ raw, convert, expected }) => {
    expect(parseAmountInput(raw, 'en', convert)).toEqual(expected)
  })
})
