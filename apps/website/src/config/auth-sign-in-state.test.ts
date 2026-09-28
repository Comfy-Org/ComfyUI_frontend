import { ENUMERATION_ORACLE } from '@comfyorg/account-core/testing'
import { describe, expect, it } from 'vitest'

import { t } from '../i18n/translations'
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
    expect(minting).toEqual({
      step: 'minting',
      email: 'a@b.co',
      origin: 'interactive'
    })
    expect(authSignInTransition(minting, { type: 'mintSucceeded' })).toEqual({
      step: 'signedIn',
      email: 'a@b.co',
      origin: 'interactive'
    })
  })

  it('detaches a dismissed popup from the controls without ending the attempt', () => {
    const detached = authSignInTransition(pending, { type: 'signInDetached' })
    expect(detached).toEqual({ step: 'detached', provider: 'google' })

    expect(
      authSignInTransition(detached, { type: 'userRestored', email: 'a@b.co' }),
      'the detached attempt still owes a provisioning step the restore path does not run'
    ).toBe(detached)

    expect(
      authSignInTransition(detached, {
        type: 'credentialSucceeded',
        email: 'a@b.co'
      }),
      'Firebase can still answer a dismissed popup with a credential'
    ).toEqual({ step: 'minting', email: 'a@b.co', origin: 'interactive' })
  })

  it('lets the visitor start a fresh attempt while an old one is detached', () => {
    const detached = authSignInTransition(pending, { type: 'signInDetached' })

    expect(
      authSignInTransition(detached, {
        type: 'signInStarted',
        provider: 'email'
      })
    ).toEqual({ step: 'pending', provider: 'email' })
    expect(authSignInTransition(detached, { type: 'signInAbandoned' })).toEqual(
      idle
    )
  })

  it('keeps a detached attempt through the sign-out its own rollback causes', () => {
    const detached = authSignInTransition(pending, { type: 'signInDetached' })
    const afterSignOut = authSignInTransition(detached, { type: 'signedOut' })

    expect(afterSignOut).toBe(detached)
    expect(
      authSignInTransition(afterSignOut, {
        type: 'userRestored',
        email: 'a@b.co'
      }),
      'falling to idle here would let a restore mint straight past the provisioning the attempt still owes'
    ).toBe(detached)
  })

  it('only detaches an attempt that is still waiting on its popup', () => {
    const minting = authSignInTransition(pending, {
      type: 'credentialSucceeded',
      email: 'a@b.co'
    })

    expect(authSignInTransition(idle, { type: 'signInDetached' })).toBe(idle)
    expect(authSignInTransition(minting, { type: 'signInDetached' })).toBe(
      minting
    )
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
    ).toEqual({ step: 'minting', email: 'a@b.co', origin: 'restored' })
  })

  it('keeps the signed-in identity and sign-out path available when minting fails', () => {
    const minting: AuthSignInState = {
      step: 'minting',
      email: 'a@b.co',
      origin: 'interactive'
    }
    expect(authSignInTransition(minting, { type: 'mintFailed' })).toEqual({
      step: 'signedIn',
      email: 'a@b.co',
      messageKey: 'auth.signIn.error.session',
      origin: 'interactive'
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

  it('clears the session-failure banner when a later refresh mints successfully', () => {
    const failed = authSignInTransition(
      { step: 'minting', email: 'a@b.co', origin: 'interactive' },
      { type: 'mintFailed' }
    )
    expect(authSignInTransition(failed, { type: 'mintSucceeded' })).toEqual({
      step: 'signedIn',
      email: 'a@b.co',
      origin: 'interactive'
    })
  })

  it('leaves a provisioning failure alone when a session mints', () => {
    const provisioningFailed: AuthSignInState = {
      step: 'signedIn',
      email: 'a@b.co',
      messageKey: 'auth.signIn.error.provisioning'
    }
    expect(
      authSignInTransition(provisioningFailed, { type: 'mintSucceeded' }),
      'a session mint says nothing about customer setup'
    ).toBe(provisioningFailed)
  })

  it('returns to idle on sign-out from signedIn, but never abandons a pending attempt', () => {
    const signedIn: AuthSignInState = { step: 'signedIn', email: 'a@b.co' }
    expect(authSignInTransition(signedIn, { type: 'signedOut' })).toEqual(idle)
    expect(authSignInTransition(pending, { type: 'signedOut' })).toBe(pending)
  })

  it('drops a pending attempt to idle when the rollout flag invalidates it', () => {
    expect(
      authSignInTransition(pending, { type: 'signInAbandoned' }),
      'a flag flip mid-attempt must leave pending so a later restore is not ignored'
    ).toEqual(idle)
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
      t('auth.errors.auth/popup-closed-by-user', 'en')
    ],
    [
      'a cancelled second popup',
      { code: 'auth/cancelled-popup-request', message: 'x' },
      t('auth.errors.auth/cancelled-popup-request', 'en')
    ],
    [
      'a blocked signup',
      { code: 'auth/internal-error', message: 'SIGNUP_BLOCKED' },
      t('auth.errors.signupBlocked', 'en')
    ],
    [
      'wrong email credentials',
      { code: 'auth/invalid-credential', message: 'x' },
      t('auth.errors.auth/invalid-credential', 'en')
    ],
    [
      'an address already registered',
      { code: 'auth/email-already-in-use', message: 'x' },
      t('auth.errors.auth/email-already-in-use', 'en')
    ],
    [
      'a throttled visitor',
      { code: 'auth/too-many-requests', message: 'x' },
      t('auth.errors.auth/too-many-requests', 'en')
    ],
    [
      'an unknown address, collapsed to the neutral invalid-credential line',
      { code: 'auth/user-not-found', message: 'x' },
      t('auth.errors.auth/invalid-credential', 'en')
    ],
    [
      'a wrong password, collapsed to the neutral invalid-credential line',
      { code: 'auth/wrong-password', message: 'x' },
      t('auth.errors.auth/invalid-credential', 'en')
    ],
    [
      'a malformed address',
      { code: 'auth/invalid-email', message: 'x' },
      t('auth.errors.auth/invalid-email', 'en')
    ],
    [
      'a network failure',
      { code: 'auth/network-request-failed', message: 'x' },
      t('auth.errors.auth/network-request-failed', 'en')
    ],
    [
      'an unknown auth code',
      { code: 'auth/some-new-code', message: 'x' },
      t('auth.errors.generic', 'en')
    ],
    [
      'a non-Firebase failure',
      new Error('customers 500'),
      t('auth.errors.generic', 'en')
    ],
    [
      'a non-auth Firebase failure, read as generic',
      { code: 'app/no-app', message: 'x' },
      t('auth.errors.generic', 'en')
    ]
  ] as const)('resolves %s from this host i18n', ([, error, copy]) => {
    expect(
      signInErrorMessage(failed(error), 'en', 'comfy.org'),
      'the account package ships the resolution rules; this host owns the copy'
    ).toBe(copy)
  })

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
    'gives %s recovery guidance that never confirms the account exists',
    ([code, why]) => {
      const message = signInErrorMessage(
        failed({ code, message: 'x' }),
        'en',
        'comfy.org'
      )
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

  it('catches account-existence synonyms the shipped neutral copy avoids', () => {
    // A re-worded leak like "This email is already registered" carries neither
    // "exists" nor "different sign-in method", so the first-draft oracle waved
    // it through; the broadened oracle rejects it while the shipped line passes.
    expect('This email is already registered').toMatch(ENUMERATION_ORACLE)
    expect(
      signInErrorMessage(
        failed({ code: 'auth/email-already-in-use', message: 'x' }),
        'en',
        'comfy.org'
      )
    ).not.toMatch(ENUMERATION_ORACLE)
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
    ).toBe(t('auth.errors.auth/popup-blocked', 'ja'))
  })
})
