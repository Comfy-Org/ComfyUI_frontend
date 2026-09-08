import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_COPY,
  AUTH_ERROR_MESSAGES
} from '@comfyorg/account/firebaseAuthError'

import type { AuthSignInState } from './auth-sign-in-state'
import { authSignInTransition, signInErrorMessage } from './auth-sign-in-state'

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

  it('mints a workspace session after authentication succeeds', () => {
    const minting = authSignInTransition(pending, {
      type: 'credentialSucceeded',
      email: 'a@b.co'
    })
    expect(minting).toEqual({ step: 'minting', email: 'a@b.co' })
    expect(authSignInTransition(minting, { type: 'mintSucceeded' })).toEqual({
      step: 'signedIn',
      email: 'a@b.co'
    })
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

  it('keeps the Firebase identity visible when customer setup fails', () => {
    expect(
      authSignInTransition(pending, {
        type: 'provisioningFailed',
        email: 'a@b.co'
      })
    ).toEqual({
      step: 'signedIn',
      email: 'a@b.co',
      messageKey: 'auth.signIn.error.provisioning'
    })
  })

  it('mints a workspace session for a returning visitor', () => {
    expect(
      authSignInTransition(idle, { type: 'userRestored', email: 'a@b.co' })
    ).toEqual({ step: 'minting', email: 'a@b.co' })
  })

  it('keeps the signed-in identity and sign-out path available when minting fails', () => {
    const minting: AuthSignInState = { step: 'minting', email: 'a@b.co' }
    expect(authSignInTransition(minting, { type: 'mintFailed' })).toEqual({
      step: 'signedIn',
      email: 'a@b.co',
      messageKey: 'auth.signIn.error.session'
    })
  })

  it('carries the classified failure so the view can resolve the shared copy', () => {
    expect(
      authSignInTransition(pending, {
        type: 'signInFailed',
        error: { code: 'auth/popup-blocked', message: 'x' }
      })
    ).toEqual({
      step: 'error',
      classification: { kind: 'popup-dismissed', code: 'auth/popup-blocked' }
    })
  })

  it('returns to idle on sign-out from signedIn, but never abandons a pending attempt', () => {
    const signedIn: AuthSignInState = { step: 'signedIn', email: 'a@b.co' }
    expect(authSignInTransition(signedIn, { type: 'signedOut' })).toEqual(idle)
    expect(authSignInTransition(pending, { type: 'signedOut' })).toBe(pending)
  })
})

describe('signInErrorMessage', () => {
  const failed = (error: unknown) => {
    const state = authSignInTransition(pending, { type: 'signInFailed', error })
    if (state.step !== 'error') throw new Error('expected the error step')
    return state.classification
  }

  it.for([
    [
      'a dismissed popup',
      { code: 'auth/popup-closed-by-user', message: 'x' },
      AUTH_ERROR_MESSAGES['auth/popup-closed-by-user']
    ],
    [
      'a blocked signup',
      { code: 'auth/internal-error', message: 'SIGNUP_BLOCKED' },
      AUTH_ERROR_MESSAGES.signupBlocked
    ],
    [
      'wrong email credentials',
      { code: 'auth/invalid-credential', message: 'x' },
      AUTH_ERROR_MESSAGES['auth/invalid-credential']
    ],
    [
      'an address already registered',
      { code: 'auth/email-already-in-use', message: 'x' },
      AUTH_ERROR_MESSAGES['auth/email-already-in-use']
    ],
    [
      'a throttled visitor',
      { code: 'auth/too-many-requests', message: 'x' },
      AUTH_ERROR_MESSAGES['auth/too-many-requests']
    ],
    [
      'a network failure, which the cloud app names',
      { code: 'auth/network-request-failed', message: 'x' },
      AUTH_ERROR_MESSAGES['auth/network-request-failed']
    ],
    [
      'an unknown auth code',
      { code: 'auth/some-new-code', message: 'x' },
      AUTH_ERROR_MESSAGES.generic
    ],
    [
      'a non-Firebase failure',
      new Error('customers 500'),
      AUTH_ERROR_MESSAGES.generic
    ]
  ] as const)("speaks the cloud app's line for %s", ([, error, copy]) => {
    expect(signInErrorMessage(failed(error), 'en', 'comfy.org')).toBe(copy)
  })

  it('names this host in the unauthorized-domain line', () => {
    expect(
      signInErrorMessage(
        failed({ code: 'auth/unauthorized-domain', message: 'x' }),
        'en',
        'preview.comfy.org'
      )
    ).toBe(
      'Your domain preview.comfy.org is not authorized to use this service. Please contact support@comfy.org to add your domain to the whitelist.'
    )
  })

  it('follows the page locale', () => {
    expect(
      signInErrorMessage(
        failed({ code: 'auth/popup-blocked', message: 'x' }),
        'ja',
        'comfy.org'
      )
    ).toBe(AUTH_ERROR_COPY.ja['auth/popup-blocked'])
  })
})
