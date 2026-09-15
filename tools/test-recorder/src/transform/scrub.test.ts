import { describe, expect, it } from 'vitest'

import { scrubSecrets } from './scrub'

const REMOVED = '// [comfy-test] removed: typing into a sensitive field'

describe('sensitive-field typing', () => {
  it.for([
    "await page.getByLabel('Password').fill('secret')",
    "await page.getByPlaceholder('Enter your password').fill('secret')",
    `await page.locator('input[type="password"]').fill('secret')`,
    "await page.getByRole('textbox', { name: 'Password' }).fill('secret')",
    "await page.getByLabel('Password').pressSequentially('secret')",
    "await page.getByLabel('Verification code').type('123456')",
    "await page.getByLabel('OTP').fill('123456')"
  ])('removes %s', (code) => {
    expect(scrubSecrets(code)).toEqual({
      code: REMOVED,
      findings: ['Removed typing into a sensitive field (line 1)']
    })
  })

  it('preserves indentation on replacement lines', () => {
    const result = scrubSecrets(
      "    await page.getByLabel('Password').fill('secret')"
    )

    expect(result.code).toBe(`    ${REMOVED}`)
  })
})

describe('credential-shaped values', () => {
  it('redacts JWTs anywhere in a line once per line', () => {
    const token = 'eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop'
    const result = scrubSecrets(`const values = ['${token}', '${token}']`)

    expect(result).toEqual({
      code: "const values = ['[REDACTED]', '[REDACTED]']",
      findings: ['Redacted a credential-shaped token (line 1)']
    })
  })

  it('redacts long token-shaped fill values', () => {
    const result = scrubSecrets(
      "await page.getByLabel('API key').fill('abcDEF0123456789+/=_abcDEF0123456789')"
    )

    expect(result).toEqual({
      code: "await page.getByLabel('API key').fill('[REDACTED]')",
      findings: ['Redacted a credential-shaped value (line 1)']
    })
  })

  it.for([
    "await page.getByLabel('Name').fill('my workflow name')",
    "await page.getByLabel('Prompt').fill('a nice prompt about cats')"
  ])('leaves ordinary fill unchanged', (code) => {
    expect(scrubSecrets(code)).toEqual({ code, findings: [] })
  })
})

describe('result metadata', () => {
  it('reports input line numbers', () => {
    const code = [
      "await page.getByLabel('Name').fill('ordinary')",
      "await page.getByLabel('Password').fill('secret')",
      "await page.getByLabel('API key').fill('abcDEF0123456789+/=_abcDEF0123456789')"
    ].join('\n')

    expect(scrubSecrets(code).findings).toEqual([
      'Removed typing into a sensitive field (line 2)',
      'Redacted a credential-shaped value (line 3)'
    ])
  })

  it('returns an empty result for empty input', () => {
    expect(scrubSecrets('')).toEqual({ code: '', findings: [] })
  })

  it('is idempotent', () => {
    const first = scrubSecrets(
      "await page.getByLabel('Password').fill('secret')\n" +
        "await page.getByLabel('API key').fill('abcDEF0123456789+/=_abcDEF0123456789')"
    )

    expect(scrubSecrets(first.code)).toEqual({
      code: first.code,
      findings: []
    })
  })
})
