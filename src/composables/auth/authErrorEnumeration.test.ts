import { describe, expect, it } from 'vitest'

import {
  authErrorMessage,
  classifyAuthError
} from '@comfyorg/account-core/firebaseAuthError'
import { ENUMERATION_ORACLE } from '@comfyorg/account-core/testing'

import { localizedAuthErrorCopy } from '@/composables/auth/useAuthActions'

// Resolves through the real cloud boundary — its own en/main.json via vue-i18n
// plus the package resolver — so rewording the shipped copy back to enumerating
// wording fails here, mirroring the website's guard.
const resolveCloudCopy = (code: string): string =>
  authErrorMessage(
    classifyAuthError({ code, message: 'x' }),
    localizedAuthErrorCopy()
  )

describe('cloud auth copy never enumerates accounts', () => {
  it.for([
    [
      'auth/email-already-in-use',
      'sign-up rejects an already-registered email'
    ],
    [
      'auth/account-exists-with-different-credential',
      'a provider collision only happens for an already-registered email'
    ]
  ] as const)(
    'gives %s neutral recovery guidance that never confirms the account exists',
    ([code, why]) => {
      const message = resolveCloudCopy(code)
      expect(
        message,
        `${why}; copy that confirms the account exists is an enumeration oracle`
      ).not.toMatch(ENUMERATION_ORACLE)
      expect(
        message,
        `${why}; the neutral copy must still offer a password reset`
      ).toMatch(/reset(?:ting)? your password/i)
    }
  )

  it.for(['auth/user-not-found', 'auth/wrong-password'] as const)(
    'collapses %s to the neutral invalid-credential line so a sign-in cannot reveal which field was wrong',
    (code) => {
      const message = resolveCloudCopy(code)
      expect(
        message,
        'user-not-found and wrong-password must render the same line as invalid-credential'
      ).toBe(resolveCloudCopy('auth/invalid-credential'))
      expect(
        message,
        'the sign-in line must not single out the email or the password'
      ).not.toMatch(ENUMERATION_ORACLE)
    }
  )
})
