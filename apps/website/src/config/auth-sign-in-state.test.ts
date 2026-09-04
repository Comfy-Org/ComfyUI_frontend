import { describe, expect, it } from 'vitest'

import type { AuthSignInState } from './auth-sign-in-state'
import { authSignInTransition } from './auth-sign-in-state'

const idle: AuthSignInState = { step: 'idle' }
const pending: AuthSignInState = { step: 'pending', provider: 'google' }
const minting: AuthSignInState = { step: 'minting', email: 'a@b.co' }
const sessionError: AuthSignInState = {
  step: 'sessionError',
  email: 'a@b.co'
}

describe('authSignInTransition', () => {
  it('starts a popup from idle and ignores clicks during pending or minting', () => {
    const started = authSignInTransition(idle, {
      type: 'signInStarted',
      provider: 'google'
    })
    expect(started).toEqual(pending)

    expect(
      authSignInTransition(started, {
        type: 'signInStarted',
        provider: 'github'
      }),
      'two popups at once would race each other for the outcome'
    ).toBe(started)
    expect(
      authSignInTransition(minting, {
        type: 'signInStarted',
        provider: 'github'
      })
    ).toBe(minting)
  })

  it('moves through popup success into minting, then signedIn', () => {
    const afterPopup = authSignInTransition(pending, {
      type: 'credentialSucceeded',
      email: 'a@b.co'
    })
    expect(afterPopup).toEqual(minting)
    expect(authSignInTransition(afterPopup, { type: 'mintSucceeded' })).toEqual(
      { step: 'signedIn', email: 'a@b.co' }
    )
  })

  it('lands a mint failure on the retry surface, never back at the popup', () => {
    expect(authSignInTransition(minting, { type: 'mintFailed' })).toEqual(
      sessionError
    )
    expect(authSignInTransition(sessionError, { type: 'mintRetried' })).toEqual(
      minting
    )
  })

  it('keeps a mid-popup restore event from short-circuiting the attempt', () => {
    expect(
      authSignInTransition(pending, { type: 'userRestored', email: 'a@b.co' }),
      'the popup resolves the Firebase user before provisioning finishes; the attempt owns the outcome'
    ).toBe(pending)
  })

  it('sends a returning Firebase user straight into minting', () => {
    expect(
      authSignInTransition(idle, { type: 'userRestored', email: 'a@b.co' })
    ).toEqual(minting)
  })

  it.for([
    [
      'a dismissed popup',
      { code: 'auth/popup-closed-by-user', message: 'x' },
      'auth.signIn.error.popupDismissed'
    ],
    [
      'an unauthorized domain',
      { code: 'auth/unauthorized-domain', message: 'x' },
      'auth.signIn.error.domain'
    ],
    [
      'a blocked signup',
      { code: 'auth/internal-error', message: 'SIGNUP_BLOCKED' },
      'auth.signIn.error.blocked'
    ],
    [
      'any other auth failure',
      { code: 'auth/network-request-failed', message: 'x' },
      'auth.signIn.error.generic'
    ],
    [
      'a non-Firebase failure',
      new Error('customers 500'),
      'auth.signIn.error.generic'
    ],
    [
      'a wrong email/password pair',
      { code: 'auth/invalid-credential', message: 'x' },
      'auth.signIn.error.invalidCredentials'
    ],
    [
      'an email already registered',
      { code: 'auth/email-already-in-use', message: 'x' },
      'auth.signIn.error.emailInUse'
    ],
    [
      'a rate-limited account',
      { code: 'auth/too-many-requests', message: 'x' },
      'auth.signIn.error.tooManyRequests'
    ]
  ] as const)('maps %s to its message key', ([, error, messageKey]) => {
    expect(
      authSignInTransition(pending, { type: 'signInFailed', error })
    ).toEqual({ step: 'error', messageKey })
  })

  it('returns to idle on sign-out, but never abandons an in-flight attempt', () => {
    const signedIn: AuthSignInState = { step: 'signedIn', email: 'a@b.co' }
    expect(authSignInTransition(signedIn, { type: 'signedOut' })).toEqual(idle)
    expect(authSignInTransition(sessionError, { type: 'signedOut' })).toEqual(
      idle
    )
    expect(authSignInTransition(pending, { type: 'signedOut' })).toBe(pending)
    expect(authSignInTransition(minting, { type: 'signedOut' })).toBe(minting)
  })
})
