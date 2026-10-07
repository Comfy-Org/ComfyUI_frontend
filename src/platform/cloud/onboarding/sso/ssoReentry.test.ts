import { describe, expect, it } from 'vitest'

import type { WebSessionEnd } from '@/platform/auth/session/cloudWebSessionStore'
import type {
  SsoReentry,
  SsoReentryAttempt
} from '@/platform/cloud/onboarding/sso/ssoReentry'
import { decideSsoReentry } from '@/platform/cloud/onboarding/sso/ssoReentry'

const hint = { email: 'ada@acme.com' }
const redirect: SsoReentry = { kind: 'sso-redirect', email: 'ada@acme.com' }
const ssoOpen: SsoReentry = { kind: 'login-with-sso-open' }
const login: SsoReentry = { kind: 'login' }

interface Case {
  readonly ssoEnabled?: boolean
  readonly sessionEnd?: WebSessionEnd
  readonly withHint?: boolean
  readonly attempt?: SsoReentryAttempt
  readonly expected: SsoReentry
}

const cases: readonly Case[] = [
  { sessionEnd: 'lapsed', withHint: true, expected: redirect },
  { sessionEnd: 'lapsed', expected: login },
  {
    sessionEnd: 'lapsed',
    withHint: true,
    attempt: 'recent',
    expected: ssoOpen
  },
  { sessionEnd: 'lapsed', attempt: 'recent', expected: login },
  {
    sessionEnd: 'lapsed',
    withHint: true,
    attempt: 'failed',
    expected: login
  },
  { sessionEnd: 'lapsed', attempt: 'failed', expected: login },
  {
    ssoEnabled: false,
    sessionEnd: 'lapsed',
    withHint: true,
    expected: login
  },
  { ssoEnabled: false, sessionEnd: 'lapsed', expected: login },
  { sessionEnd: 'signed_out_here', withHint: true, expected: login },
  { sessionEnd: 'signed_out_here', expected: login },
  { sessionEnd: 'revoked', withHint: true, expected: login },
  { sessionEnd: 'restore_failed', withHint: true, expected: login },
  { withHint: true, expected: login }
]

describe(decideSsoReentry, () => {
  it.for(cases)(
    'sso $ssoEnabled, end $sessionEnd, hint $withHint, attempt $attempt',
    ({
      ssoEnabled = true,
      sessionEnd,
      withHint = false,
      attempt = 'none',
      expected
    }) => {
      expect(
        decideSsoReentry({
          ssoEnabled,
          sessionEnd,
          hint: withHint ? hint : null,
          attempt
        })
      ).toEqual(expected)
    }
  )
})
