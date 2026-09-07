import { describe, expect, it } from 'vitest'

import { SESSION_SUCCESS_MESSAGES } from '@comfyorg/account/core'
import { AUTH_ERROR_MESSAGES } from '@comfyorg/account/firebaseAuthError'

import { hasKey, t } from './translations'

const SHARED_COPY: ReadonlyArray<readonly [string, string]> = [
  [
    'auth.signIn.error.popupClosed',
    AUTH_ERROR_MESSAGES['auth/popup-closed-by-user']
  ],
  [
    'auth.signIn.error.popupCancelled',
    AUTH_ERROR_MESSAGES['auth/cancelled-popup-request']
  ],
  ['auth.signIn.error.popupBlocked', AUTH_ERROR_MESSAGES['auth/popup-blocked']],
  ['auth.signIn.error.blocked', AUTH_ERROR_MESSAGES['signupBlocked']],
  ['auth.signIn.error.generic', AUTH_ERROR_MESSAGES['generic']],
  [
    'auth.signIn.error.invalidCredentials',
    AUTH_ERROR_MESSAGES['auth/invalid-credential']
  ],
  [
    'auth.signIn.error.emailInUse',
    AUTH_ERROR_MESSAGES['auth/email-already-in-use']
  ],
  [
    'auth.signIn.error.tooManyRequests',
    AUTH_ERROR_MESSAGES['auth/too-many-requests']
  ],
  ['auth.signIn.signedInHeading', SESSION_SUCCESS_MESSAGES.signedInHeading],
  ['auth.signIn.signedInAs', SESSION_SUCCESS_MESSAGES.signedInAs]
]

describe('auth copy stays in step with the shared source', () => {
  it.for(SHARED_COPY)(
    '%s matches the cloud-extracted copy',
    ([key, shared]) => {
      if (!hasKey(key)) {
        throw new Error(`translations.ts has no entry for ${key}`)
      }
      expect(
        t(key),
        "both surfaces speak the cloud app's shipped copy; edits go to the shared table first"
      ).toBe(shared)
    }
  )
})
