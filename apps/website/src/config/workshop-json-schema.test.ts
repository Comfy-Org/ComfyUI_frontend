import { describe, expect, it } from 'vitest'

import { validatorFor } from './workshop-json-schema'

describe('Workshop JSON schema formats', () => {
  it('validates multi-megabyte byte strings without overflowing the stack', () => {
    const validate = validatorFor({ type: 'string', format: 'byte' })
    const image = 'A'.repeat(6 * 1024 * 1024)

    expect(() => validate(image)).not.toThrow()
    expect(validate(image)).toBe(true)
  })

  it.for([
    ['', true],
    ['AA==', true],
    ['AAA=', true],
    ['AAAA', true],
    ['AAA', false],
    ['A===', false],
    ['AA=A', false],
    ['AA-_', false]
  ] as const)('validates byte value %j as %s', ([value, expected]) => {
    expect(validatorFor({ type: 'string', format: 'byte' })(value)).toBe(
      expected
    )
  })
})
