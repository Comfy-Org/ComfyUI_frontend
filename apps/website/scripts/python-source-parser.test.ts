import { describe, expect, it } from 'vitest'

import { sliceBalanced } from './python-source-parser'

describe('sliceBalanced', () => {
  it('returns nested source through the matching closing bracket', () => {
    expect(sliceBalanced('[first, call("]"), [second]] trailing', 0)).toBe(
      'first, call("]"), [second]'
    )
  })

  it('rejects source whose opening bracket is not closed', () => {
    expect(() => sliceBalanced('[first, [second]', 0)).toThrow(
      'Unbalanced [ at index 0 while parsing node schema'
    )
  })
})
