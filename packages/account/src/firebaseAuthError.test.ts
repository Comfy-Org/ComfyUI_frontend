import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_MESSAGES,
  classifyAuthError,
  severityForAuthError
} from './firebaseAuthError'

const firebaseError = (code: string, message = 'Firebase: error.') => ({
  code,
  message
})

describe('classifyAuthError', () => {
  it.for([
    'auth/unauthorized-domain',
    'auth/invalid-dynamic-link-domain',
    'auth/unauthorized-continue-uri'
  ])('classifies %s as unauthorized-domain', (code) => {
    expect(classifyAuthError(firebaseError(code))).toEqual({
      kind: 'unauthorized-domain',
      code
    })
  })

  it.for([
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
    'auth/popup-blocked'
  ])('classifies %s as popup-dismissed', (code) => {
    expect(classifyAuthError(firebaseError(code))).toEqual({
      kind: 'popup-dismissed',
      code
    })
  })

  it('detects signup_blocked from the message regardless of case or code', () => {
    expect(
      classifyAuthError(
        firebaseError('auth/internal-error', 'Firebase: SIGNUP_BLOCKED (...)')
      ),
      'beforeUserCreated rejections collapse the code to auth/internal-error, so the message is the only channel'
    ).toEqual({ kind: 'signup-blocked', code: 'auth/internal-error' })
  })

  it('classifies any other auth/* code as a plain auth error carrying its code', () => {
    expect(classifyAuthError(firebaseError('auth/wrong-password'))).toEqual({
      kind: 'auth',
      code: 'auth/wrong-password'
    })
  })

  it.for([
    ['a non-error object', { some: 'thing' }],
    ['a plain Error', new Error('boom')],
    ['a non-auth code shape', { code: 'storage/unknown', message: 'x' }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'auth/popup-blocked'],
    // The message half of the structural guard: an auth/ code with a missing
    // or non-string message must still land in 'unknown' — otherwise the
    // .toLowerCase() signup_blocked check throws on a non-string message.
    ['an auth/ code with no message', { code: 'auth/internal-error' }],
    [
      'an auth/ code with a non-string message',
      { code: 'auth/internal-error', message: 123 }
    ]
  ] as const)('classifies %s as unknown', ([, value]) => {
    expect(classifyAuthError(value)).toEqual({ kind: 'unknown' })
  })
})

describe('shared auth error copy and severity', () => {
  it('carries a message for every popup-dismissal code and the named fallbacks', () => {
    for (const code of [
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/popup-blocked'
    ]) {
      expect(
        AUTH_ERROR_MESSAGES[code],
        `each dismissal shape has its own copy in the cloud app; ${code} losing its entry silently degrades to the generic string`
      ).toBeTruthy()
    }
    expect(AUTH_ERROR_MESSAGES['generic']).toBeTruthy()
    expect(AUTH_ERROR_MESSAGES['signupBlocked']).toBeTruthy()
  })

  it('marks a dismissed popup as a warning and every real failure as an error', () => {
    expect(
      severityForAuthError({
        kind: 'popup-dismissed',
        code: 'auth/cancelled-popup-request'
      }),
      'the user closing a window is not an application error'
    ).toBe('warn')
    for (const classification of [
      { kind: 'unauthorized-domain', code: 'auth/unauthorized-domain' },
      { kind: 'signup-blocked', code: 'auth/internal-error' },
      { kind: 'auth', code: 'auth/invalid-credential' },
      { kind: 'unknown' }
    ] as const) {
      expect(severityForAuthError(classification)).toBe('error')
    }
  })
})
