import { describe, expect, it } from 'vitest'

import { SSO_ERROR_CODES } from '@comfyorg/account-core/sso'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { ssoErrorMessageKey } from '@/platform/cloud/onboarding/sso/ssoErrorMessages'

const ssoErrors: Record<string, string> = enMessages.auth.sso.errors

const englishFor = (code: Parameters<typeof ssoErrorMessageKey>[0]) =>
  ssoErrors[ssoErrorMessageKey(code).replace('auth.sso.errors.', '')]

describe('ssoErrorMessageKey', () => {
  it('gives every SSO error code English copy', () => {
    const uncovered = [...SSO_ERROR_CODES, 'unknown' as const].filter(
      (code) => !englishFor(code)
    )

    expect(uncovered).toEqual([])
  })

  it.for([
    [
      'SSO_USER_SUSPENDED',
      'Your organization has removed your access. Contact your IT admin.'
    ],
    [
      'SSO_ORG_DISABLED',
      'Single sign-on is turned off for your organization. Contact your IT admin.'
    ],
    [
      'RATE_LIMITED',
      'Too many sign-in attempts. Please wait a few minutes and try again.'
    ],
    [
      'unknown',
      "We couldn't sign you in with single sign-on. Please try again."
    ]
  ] as const)('explains %s', ([code, expected]) => {
    expect(englishFor(code)).toBe(expected)
  })
})
