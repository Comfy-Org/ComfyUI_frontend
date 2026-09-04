import { describe, expect, it } from 'vitest'

import { classifyAuthError } from './firebaseAuthError'

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
    ['a string', 'auth/popup-blocked']
  ] as const)('classifies %s as unknown', ([, value]) => {
    expect(classifyAuthError(value)).toEqual({ kind: 'unknown' })
  })
})
