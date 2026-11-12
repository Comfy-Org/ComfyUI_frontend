import { describe, expect, it } from 'vitest'

import { normalizeEmail } from './normalizeEmail'

describe('normalizeEmail', () => {
  it.for([
    { name: 'null', input: null, expected: null },
    { name: 'undefined', input: undefined, expected: null },
    { name: 'an empty string', input: '', expected: null },
    { name: 'a whitespace-only string', input: '   ', expected: null },
    {
      name: 'a padded mixed-case email',
      input: '  Alice@Example.COM  ',
      expected: 'alice@example.com'
    }
  ])('normalizes $name', ({ input, expected }) => {
    expect(normalizeEmail(input)).toBe(expected)
  })
})
