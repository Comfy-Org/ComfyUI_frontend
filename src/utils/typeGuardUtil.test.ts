import { describe, expect, it } from 'vitest'

import { isAbortError, isResultItemType } from './typeGuardUtil'

describe('isAbortError', () => {
  it.for([
    {
      name: 'DOMException AbortError',
      error: new DOMException('', 'AbortError'),
      expected: true
    },
    {
      name: 'DOMException of another name',
      error: new DOMException('', 'TimeoutError'),
      expected: false
    },
    {
      name: 'plain Error named AbortError',
      error: Object.assign(new Error(), { name: 'AbortError' }),
      expected: false
    }
  ])('$name -> $expected', ({ error, expected }) => {
    expect(isAbortError(error)).toBe(expected)
  })
})

describe('isResultItemType', () => {
  it.for([
    { value: 'input', expected: true },
    { value: 'output', expected: true },
    { value: 'temp', expected: true },
    { value: 'Output', expected: false },
    { value: '', expected: false },
    { value: undefined, expected: false }
  ])('$value -> $expected', ({ value, expected }) => {
    expect(isResultItemType(value)).toBe(expected)
  })
})
