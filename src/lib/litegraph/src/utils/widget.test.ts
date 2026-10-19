import { describe, expect, test } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IWidgetOptions,
  TWidgetValue
} from '@/lib/litegraph/src/litegraph'
import type { IColorWidget } from '@/lib/litegraph/src/types/widgets'
import {
  evaluateInput,
  getWidgetStep,
  resolveNodeRootGraphId
} from '@/lib/litegraph/src/litegraph'
import {
  coerceRestoredWidgetValue,
  formatNumericWidgetValue
} from '@/lib/litegraph/src/utils/widget'

describe('getWidgetStep', () => {
  test('should return step2 when available', () => {
    const options: IWidgetOptions = {
      step2: 0.5,
      step: 20
    }

    expect(getWidgetStep(options)).toBe(0.5)
  })

  test('should calculate from step when step2 is not available', () => {
    const options: IWidgetOptions = {
      step: 20
    }

    expect(getWidgetStep(options)).toBe(2) // 20 * 0.1 = 2
  })

  test('should use default step value of 10 when neither step2 nor step is provided', () => {
    const options: IWidgetOptions = {}

    expect(getWidgetStep(options)).toBe(1) // 10 * 0.1 = 1
  })
  // Zero value is not allowed for step, fallback to 1.
  test('should handle zero values correctly', () => {
    const optionsWithZeroStep2: IWidgetOptions = {
      step2: 0,
      step: 20
    }

    expect(getWidgetStep(optionsWithZeroStep2)).toBe(2)

    const optionsWithZeroStep: IWidgetOptions = {
      step: 0
    }

    expect(getWidgetStep(optionsWithZeroStep)).toBe(1)
  })
})

describe('formatNumericWidgetValue', () => {
  test.for<[string, unknown]>([
    ['symbol', Symbol('legacy')],
    ['object without primitive conversion', Object.create(null)]
  ])('formats %s coercion failures as NaN', ([_label, value]) => {
    expect(formatNumericWidgetValue(value)).toBe('NaN')
  })
})

describe('coerceRestoredWidgetValue', () => {
  test('restores a numeric string for an INT color widget as a number', () => {
    const widget: Pick<IColorWidget, 'type' | 'options'> = {
      type: 'color',
      options: { format: 'int' }
    }
    expect(coerceRestoredWidgetValue(widget, '16777215')).toBe(16777215)
  })

  test('preserves structured values with unknown keys', () => {
    const value = { future: { nested: true }, known: 'kept' }

    expect(
      coerceRestoredWidgetValue({ type: 'custom', options: {} }, value)
    ).toBe(value)
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

type GraphIdNode = Pick<LGraphNode, 'graph'>

describe('resolveNodeRootGraphId', () => {
  test('returns node rootGraph id when node belongs to a graph', () => {
    const node = {
      graph: {
        rootGraph: {
          id: 'subgraph-root-id'
        }
      }
    } as GraphIdNode

    expect(resolveNodeRootGraphId(node)).toBe('subgraph-root-id')
  })

  test('returns fallback graph id when node graph is missing', () => {
    const node = {
      graph: null
    } as GraphIdNode

    expect(resolveNodeRootGraphId(node, 'app-root-id')).toBe('app-root-id')
  })
})

describe('evaluateInput', () => {
  test.for<[string, number]>([
    ['42', 42],
    ['3.14', 3.14],
    ['-7', -7],
    ['0', 0]
  ])('plain number: "%s" = %d', ([input, expected]) => {
    expect(evaluateInput(input)).toBe(expected)
  })

  test.for<[string, number]>([
    ['2+3', 5],
    ['(4+2)*3', 18],
    ['3.14*2', 6.28],
    ['10/2+3', 8]
  ])('expression: "%s" = %d', ([input, expected]) => {
    expect(evaluateInput(input)).toBe(expected)
  })

  test('empty string returns 0 (Number("") === 0)', () => {
    expect(evaluateInput('')).toBe(0)
  })

  test.for(['abc', 'hello world'])(
    'invalid input returns undefined: "%s"',
    (input) => {
      expect(evaluateInput(input)).toBeUndefined()
    }
  )

  test('division by zero returns undefined', () => {
    expect(evaluateInput('1/0')).toBeUndefined()
  })

  test('0/0 returns undefined (NaN is filtered)', () => {
    expect(evaluateInput('0/0')).toBeUndefined()
  })

  test('scientific notation via Number() fallback', () => {
    expect(evaluateInput('1e5')).toBe(100000)
  })

  test('hex notation via Number() fallback', () => {
    expect(evaluateInput('0xff')).toBe(255)
  })

  test.for(['Infinity', '-Infinity'])(
    '"%s" returns undefined (non-finite rejected)',
    (input) => {
      expect(evaluateInput(input)).toBeUndefined()
    }
  )
})
