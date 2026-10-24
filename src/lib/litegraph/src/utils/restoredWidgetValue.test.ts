import { describe, expect, test } from 'vitest'

import type {
  IColorWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import { coerceRestoredWidgetValue } from '@/lib/litegraph/src/utils/restoredWidgetValue'

describe('coerceRestoredWidgetValue', () => {
  test('restores a numeric string for an INT color widget as a number', () => {
    const widget: Pick<IColorWidget, 'type' | 'options'> = {
      type: 'color',
      options: { format: 'int' }
    }
    expect(coerceRestoredWidgetValue(widget, '16777215')).toBe(16777215)
  })

  test.for<{
    name: string
    type: string
    precision?: number
    value: TWidgetValue
    expected: TWidgetValue
  }>([
    {
      name: 'an INT numeric string',
      type: 'number',
      precision: 0,
      value: '1536',
      expected: 1536
    },
    {
      name: 'a FLOAT numeric string',
      type: 'number',
      precision: 2,
      value: '0.5',
      expected: 0.5
    },
    {
      name: 'a decimal string in scientific notation',
      type: 'number',
      precision: 2,
      value: '1e3',
      expected: 1000
    },
    {
      name: 'a fractional string for a FLOAT displayed at precision 0',
      type: 'number',
      precision: 0,
      value: '29.97',
      expected: 29.97
    },
    {
      name: 'an integer string beyond the safe integer range',
      type: 'number',
      precision: 0,
      value: '18446744073709551615',
      expected: '18446744073709551615'
    },
    {
      name: 'the largest safe integer string',
      type: 'number',
      value: '9007199254740991',
      expected: 9007199254740991
    },
    {
      name: 'an unsafe integer string without a precision',
      type: 'number',
      value: '18446744073709551615',
      expected: '18446744073709551615'
    },
    {
      name: 'a non-numeric string',
      type: 'number',
      precision: 0,
      value: 'auto',
      expected: 'auto'
    },
    {
      name: 'a hexadecimal string',
      type: 'number',
      precision: 0,
      value: '0x10',
      expected: '0x10'
    },
    {
      name: 'a binary string',
      type: 'number',
      precision: 0,
      value: '0b11',
      expected: '0b11'
    },
    {
      name: 'an octal string',
      type: 'number',
      precision: 0,
      value: '0o17',
      expected: '0o17'
    },
    {
      name: 'a whitespace-only string',
      type: 'number',
      precision: 2,
      value: ' ',
      expected: ' '
    },
    {
      name: 'a non-decimal Infinity string',
      type: 'number',
      precision: 2,
      value: 'Infinity',
      expected: 'Infinity'
    },
    {
      name: 'a decimal exponent that overflows to Infinity',
      type: 'number',
      value: '1e400',
      expected: '1e400'
    },
    {
      name: 'a slider numeric string',
      type: 'slider',
      precision: 0,
      value: '8',
      expected: 8
    },
    {
      name: 'a knob numeric string',
      type: 'knob',
      precision: 2,
      value: '0.25',
      expected: 0.25
    },
    {
      name: 'a gradient slider numeric string',
      type: 'gradientslider',
      precision: 1,
      value: '1',
      expected: 1
    },
    {
      name: 'a non-string value for a number widget',
      type: 'number',
      precision: 0,
      value: true,
      expected: true
    },
    {
      name: 'a BOOLEAN false string',
      type: 'toggle',
      value: 'false',
      expected: false
    },
    {
      name: 'a padded upper-case BOOLEAN string',
      type: 'toggle',
      value: ' TRUE ',
      expected: true
    },
    {
      name: 'a non-boolean string for a BOOLEAN',
      type: 'toggle',
      value: 'yes',
      expected: 'yes'
    },
    {
      name: 'a numeric string for a COMBO',
      type: 'combo',
      value: '8',
      expected: '8'
    },
    {
      name: 'a numeric string for a STRING',
      type: 'text',
      value: '1536',
      expected: '1536'
    },
    {
      name: 'a numeric-looking string-backed color',
      type: 'color',
      value: '123456',
      expected: '123456'
    }
  ])('restores $name as $expected', ({ type, precision, value, expected }) => {
    expect(
      coerceRestoredWidgetValue({ type, options: { precision } }, value)
    ).toBe(expected)
  })
})
