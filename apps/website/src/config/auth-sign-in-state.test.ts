import { describe, expect, it } from 'vitest'

import type { AuthSignInState } from './auth-sign-in-state'
import { authSignInTransition } from './auth-sign-in-state'

const idle: AuthSignInState = { step: 'idle' }
const pending: AuthSignInState = { step: 'pending', provider: 'google' }

describe('authSignInTransition', () => {
  it('starts a popup from idle and ignores a second click while pending', () => {
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
  })

  it('lands on signedIn when the full attempt (popup + provisioning) succeeds', () => {
    expect(
      authSignInTransition(pending, {
        type: 'signInSucceeded',
        email: 'a@b.co'
      })
    ).toEqual({ step: 'signedIn', email: 'a@b.co' })
  })

  it('keeps a mid-popup restore event from short-circuiting the attempt', () => {
    expect(
      authSignInTransition(pending, {
        type: 'userRestored',
        email: 'a@b.co'
      }),
      'the popup resolves the Firebase user before provisioning finishes; the attempt owns the outcome'
    ).toBe(pending)
  })

  it('restores a returning visitor straight to signedIn', () => {
    expect(
      authSignInTransition(idle, { type: 'userRestored', email: 'a@b.co' })
    ).toEqual({ step: 'signedIn', email: 'a@b.co' })
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
    ]
  ] as const)('maps %s to its message key', ([, error, messageKey]) => {
    expect(
      authSignInTransition(pending, { type: 'signInFailed', error })
    ).toEqual({ step: 'error', messageKey })
  })

  it('returns to idle on sign-out from signedIn, but never abandons a pending attempt', () => {
    const signedIn: AuthSignInState = { step: 'signedIn', email: 'a@b.co' }
    expect(authSignInTransition(signedIn, { type: 'signedOut' })).toEqual(idle)
    expect(authSignInTransition(pending, { type: 'signedOut' })).toBe(pending)
  })
})
