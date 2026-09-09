import { describe, expect, it } from 'vitest'

import { requirePlaceholder } from './placeholders'

describe('requirePlaceholder', () => {
  it('passes a name the string is allowed to carry', () => {
    expect(requirePlaceholder('email', ['break', 'email'], 'some.key')).toBe(
      'email'
    )
  })

  /**
   * The defect this exists for. Each of these placeholder loops ended in a
   * wildcard branch, so a name nobody expected rendered the enterprise email
   * address, or an empty plan name, instead of failing.
   *
   * `i18n:validate` compares placeholders between English and each translation,
   * but only across the machine layer — approved human translations in
   * `source.ts` never reach it. So an approved translation carrying an
   * unexpected placeholder had nothing standing between it and a wrong support
   * address on a live page. Failing the build is the point: a static site can
   * still be fixed before anyone reads it.
   */
  it('rejects a name the string should not carry', () => {
    expect(() =>
      requirePlaceholder('sales', ['break', 'email'], 'some.key')
    ).toThrow(/unexpected placeholder \{sales\}/)
  })

  it('names the key and the expected set, so the fix is obvious', () => {
    expect(() =>
      requirePlaceholder('sales', ['email'], 'contact.line')
    ).toThrow(/contact\.line.*expected one of email/s)
  })
})
