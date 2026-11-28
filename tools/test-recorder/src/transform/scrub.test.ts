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
  ])('leaves ordinary fill unchanged in %s', (code) => {
    expect(scrubSecrets(code)).toEqual({ code, findings: [] })
  })
})

describe('api-key formats', () => {
  const filler = (chars: string, n: number) => chars.repeat(n).slice(0, n)

  it.for([
    [
      'OpenAI sk-proj-',
      () => `const key = "sk-proj-${filler('Ab1', 48)}"`,
      () => `sk-proj-${filler('Ab1', 48)}`
    ],
    [
      'Anthropic sk-ant-',
      () => `const key = "sk-ant-api03-${filler('Ab1', 48)}"`,
      () => `sk-ant-api03-${filler('Ab1', 48)}`
    ],
    [
      'GitHub ghp_',
      () => `const token = 'ghp_${filler('Ab1', 36)}'`,
      () => `ghp_${filler('Ab1', 36)}`
    ],
    [
      'GitHub fine-grained',
      () => `const token = 'github_pat_${filler('Ab1', 40)}'`,
      () => `github_pat_${filler('Ab1', 40)}`
    ],
    [
      'GitLab glpat-',
      () => `const token = 'glpat-${filler('Ab1', 20)}'`,
      () => `glpat-${filler('Ab1', 20)}`
    ],
    [
      'AWS AKIA',
      () => `await page.getByLabel('AWS key').fill('AKIA${filler('AB1', 16)}')`,
      () => `AKIA${filler('AB1', 16)}`
    ],
    [
      'Slack xoxb-',
      () => `const token = 'xoxb-123456789012-${filler('Ab1', 16)}'`,
      () => `xoxb-123456789012-${filler('Ab1', 16)}`
    ],
    [
      'Google AIza',
      () => `const token = 'AIza${filler('Ab1', 35)}'`,
      () => `AIza${filler('Ab1', 35)}`
    ],
    [
      'Shopify shpat_',
      () => `const token = 'shpat_${filler('Ab1', 32)}'`,
      () => `shpat_${filler('Ab1', 32)}`
    ],
    [
      'GitHub installation ghs_',
      () => `const token = 'ghs_${filler('Ab1', 36)}'`,
      () => `ghs_${filler('Ab1', 36)}`
    ],
    [
      'GitHub user-to-server ghu_',
      () => `const token = 'ghu_${filler('Ab1', 36)}'`,
      () => `ghu_${filler('Ab1', 36)}`
    ],
    [
      'GitHub refresh ghr_',
      () => `const token = 'ghr_${filler('Ab1', 36)}'`,
      () => `ghr_${filler('Ab1', 36)}`
    ],
    [
      'Slack app-level xapp-',
      () => `const token = 'xapp-1-AbCdEf-${filler('Ab1', 20)}'`,
      () => `xapp-1-AbCdEf-${filler('Ab1', 20)}`
    ],
    [
      'GitHub PAT after an underscore',
      () =>
        `await page.getByTestId('token').type('value_ghp_${filler('Ab1', 36)}')`,
      () => `value_ghp_${filler('Ab1', 36)}`,
      () => `ghp_${filler('Ab1', 36)}`
    ],
    [
      'GitHub JWT-style installation ghs_',
      () =>
        `const token = 'ghs_123_eyJ${filler('Ab1', 24)}.${filler('Ey1', 24)}.${filler('Ab1', 20)}'`,
      () =>
        `ghs_123_eyJ${filler('Ab1', 24)}.${filler('Ey1', 24)}.${filler('Ab1', 20)}`
    ],
    [
      'JWT after an underscore',
      () =>
        `await page.getByTestId('token').fill('value_eyJ${filler('Ab1', 16)}.${filler('Ey1', 16)}.${filler('Ab1', 16)}')`,
      () =>
        `value_eyJ${filler('Ab1', 16)}.${filler('Ey1', 16)}.${filler('Ab1', 16)}`,
      () => `eyJ${filler('Ab1', 16)}.${filler('Ey1', 16)}.${filler('Ab1', 16)}`
    ]
  ] as const)('redacts the %sformat', ([, makeCode, makeSecret, makeMatch]) => {
    const code = makeCode()
    const result = scrubSecrets(code)
    const match = (makeMatch ?? makeSecret)()

    expect(result.code).toBe(code.replace(match, '[REDACTED]'))
    expect(result.findings).toEqual([
      'Redacted a credential-shaped token (line 1)'
    ])
  })

  it('leaves hyphenated identifiers that only start with sk- alone', () => {
    const code = "const model = 'sk-learn-gradient-boosting-config'"

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
