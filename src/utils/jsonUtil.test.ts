import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseJsonWithNonFinite', () => {
  it('parses standard JSON unchanged', () => {
    expect(
      parseJsonWithNonFinite(
        '{"x": 1, "y": "hello", "z": [1, 2, null, true, false]}'
      )
    ).toEqual({ x: 1, y: 'hello', z: [1, 2, null, true, false] })
  })

  it('handles compact Python separators with no spaces', () => {
    expect(parseJsonWithNonFinite('{"a":NaN,"b":Infinity}')).toEqual({
      a: null,
      b: null
    })
  })

  it('coerces NaN as the last value before object close', () => {
    expect(parseJsonWithNonFinite('{"a":1,"b":NaN}')).toEqual({
      a: 1,
      b: null
    })
  })

  it('handles multi-line pretty-printed Python output', () => {
    expect(
      parseJsonWithNonFinite('{\n  "x": NaN,\n  "y": Infinity\n}')
    ).toEqual({
      x: null,
      y: null
    })
  })

  it('coerces NaN deeply nested across object and array levels', () => {
    expect(
      parseJsonWithNonFinite(
        '{"a": {"b": {"c": [1, {"d": [NaN, [Infinity, {"e": -Infinity}]]}]}}}'
      )
    ).toEqual({
      a: { b: { c: [1, { d: [null, [null, { e: null }]] }] } }
    })
  })

  it.for([
    ['NaN', null],
    ['Infinity', null],
    ['-Infinity', null],
    ['null', null],
    ['true', true],
    ['false', false],
    ['{}', {}],
    ['[]', []]
  ] as const)('parses bare top-level value: %s', ([input, expected]) => {
    expect(parseJsonWithNonFinite(input)).toEqual(expected)
  })

  it.for([
    ['[NaN]', [null]],
    ['[Infinity]', [null]],
    ['[-Infinity]', [null]]
  ] as const)(
    'coerces token at right-boundary of array: %s',
    ([input, expected]) => {
      expect(parseJsonWithNonFinite(input)).toEqual(expected)
    }
  )

  it.for([
    ['tab', '{"x":\tNaN}'],
    ['newline', '{"x":\nNaN}'],
    ['carriage return', '{"x":\rNaN}'],
    ['runs of spaces', '{"x":   NaN}']
  ])('treats %s as a delimiter', ([, input]) => {
    expect(parseJsonWithNonFinite(input)).toEqual({ x: null })
  })

  it('preserves NaN appearing inside string values', () => {
    expect(parseJsonWithNonFinite('{"desc": "value is NaN here"}')).toEqual({
      desc: 'value is NaN here'
    })
  })

  it('preserves Infinity appearing inside string values', () => {
    expect(parseJsonWithNonFinite('{"x": "to Infinity and beyond"}')).toEqual({
      x: 'to Infinity and beyond'
    })
  })

  it('preserves NaN appearing as a string key', () => {
    expect(parseJsonWithNonFinite('{"NaN": 1, "Infinity": 2}')).toEqual({
      NaN: 1,
      Infinity: 2
    })
  })

  it('preserves token-like substrings inside strings with escaped quotes', () => {
    expect(
      parseJsonWithNonFinite('{"x": "say \\"NaN\\" loud", "y": NaN}')
    ).toEqual({
      x: 'say "NaN" loud',
      y: null
    })
  })

  it('handles escaped backslash immediately before a closing quote', () => {
    expect(parseJsonWithNonFinite('{"x": "a\\\\", "y": NaN}')).toEqual({
      x: 'a\\',
      y: null
    })
  })

  it('preserves token-like text after escape sequences inside strings', () => {
    expect(
      parseJsonWithNonFinite('{"x": "a\\nNaN", "y": "\\u0022Infinity\\u0022"}')
    ).toEqual({ x: 'a\nNaN', y: '"Infinity"' })
  })

  it('throws SyntaxError on otherwise-invalid JSON', () => {
    expect(() => parseJsonWithNonFinite('{not json}')).toThrow(SyntaxError)
  })

  it.for([
    ['NaN with trailing digits', '{"x": NaN123}'],
    ['Infinity with trailing letter', '{"x": Infinityy}'],
    ['-Infinity with trailing digit', '{"x": -Infinity0}'],
    ['adjacent NaNs', '{"x": NaNNaN}'],
    ['-Infinity with trailing letter', '{"x": -Infinityy}']
  ])('throws on partial token match: %s', ([, input]) => {
    expect(() => parseJsonWithNonFinite(input)).toThrow(SyntaxError)
  })

  it.for([
    ['after digit', '{"x": 1-Infinity}'],
    ['after decimal float', '{"x": 1.5-Infinity}']
  ])(
    'throws when -Infinity is not delimiter-bounded on the left: %s',
    ([, input]) => {
      expect(() => parseJsonWithNonFinite(input)).toThrow(SyntaxError)
    }
  )

  it('throws on unterminated string ending in a lone backslash', () => {
    expect(() => parseJsonWithNonFinite('{"x": "abc\\')).toThrow(SyntaxError)
  })

  it('throws on unsupported +Infinity prefix', () => {
    expect(() => parseJsonWithNonFinite('{"x": +Infinity}')).toThrow(
      SyntaxError
    )
  })

  it('does not treat non-ASCII letters as a token boundary (throws)', () => {
    expect(() => parseJsonWithNonFinite('{"x": éNaN}')).toThrow(SyntaxError)
  })

  it.for([
    ['top-level JSON string of NaN', '"NaN"', 'NaN'],
    ['token alone as string value', '{"x": "NaN"}', { x: 'NaN' }],
    [
      '-Infinity alone as string value',
      '{"x": "-Infinity"}',
      { x: '-Infinity' }
    ],
    [
      'multiple tokens in one string',
      '{"x": "NaN Infinity -Infinity"}',
      { x: 'NaN Infinity -Infinity' }
    ],
    [
      'token as prefix of identifier in string',
      '{"s": "NaNny"}',
      { s: 'NaNny' }
    ],
    [
      'hyphen-bracketed Infinity in string',
      '{"s": "pre-Infinity-post"}',
      { s: 'pre-Infinity-post' }
    ]
  ] as const)(
    'preserves token text inside string contexts: %s',
    ([, input, expected]) => {
      expect(parseJsonWithNonFinite(input)).toEqual(expected)
    }
  )

  it('preserves numeric exponents (does not match Infinity prefix)', () => {
    expect(parseJsonWithNonFinite('[1e10, -1.5e-3]')).toEqual([1e10, -1.5e-3])
  })

  it.for([
    ['token embedded in identifier', '{"x": fooNaNbar}'],
    ['Infinity followed by decimal point', '{"x": Infinity.123}'],
    ['trailing garbage after valid JSON', '{"a": 1} extra'],
    ['bare unknown identifier', '{"a": Foo}']
  ])('throws on invalid JSON: %s', ([, input]) => {
    expect(() => parseJsonWithNonFinite(input)).toThrow(SyntaxError)
  })

  it('handles 10k-element array of mixed tokens without backtracking', () => {
    const items = Array.from({ length: 10000 }, (_, i) =>
      i % 3 === 0 ? 'NaN' : i % 3 === 1 ? 'Infinity' : '-Infinity'
    ).join(',')
    const result = parseJsonWithNonFinite<null[]>(`[${items}]`)
    expect(result).toHaveLength(10000)
    expect(result[0]).toBeNull()
    expect(result[9999]).toBeNull()
  })

  describe('fallback warning', () => {
    it('does not warn when strict parse succeeds', () => {
      parseJsonWithNonFinite('{"a": 1}')
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('warns once per call regardless of how many tokens are replaced', () => {
      parseJsonWithNonFinite('{"a": NaN, "b": Infinity, "c": [-Infinity, NaN]}')
      expect(console.warn).toHaveBeenCalledTimes(1)
    })

    it('warns again on a separate call', () => {
      parseJsonWithNonFinite('{"a": NaN}')
      parseJsonWithNonFinite('{"b": Infinity}')
      expect(console.warn).toHaveBeenCalledTimes(2)
    })

    it('does not warn when the relaxed parse itself throws on input with no tokens', () => {
      expect(() => parseJsonWithNonFinite('{not json}')).toThrow(SyntaxError)
      expect(console.warn).not.toHaveBeenCalled()
    })
  })
})
