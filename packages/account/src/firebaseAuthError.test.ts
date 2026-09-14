import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_COPY,
  AUTH_ERROR_MESSAGES,
  AUTH_TOAST_SUMMARIES,
  UNAUTHORIZED_DOMAIN_MESSAGES,
  authErrorMessage,
  classifyAuthError,
  severityForAuthError,
  unauthorizedDomainMessage
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

describe('AUTH_ERROR_COPY', () => {
  it.for(['zh-CN', 'ja'] as const)(
    '%s carries every key the English table has, and nothing else',
    (locale) => {
      expect(Object.keys(AUTH_ERROR_COPY[locale]).sort()).toEqual(
        Object.keys(AUTH_ERROR_MESSAGES).sort()
      )
    }
  )

  it('keeps the English table as the en entry', () => {
    expect(AUTH_ERROR_COPY.en).toBe(AUTH_ERROR_MESSAGES)
  })

  it.for(['en', 'zh-CN', 'ja'] as const)(
    '%s sign-in failures do not reveal whether the email has an account',
    (locale) => {
      const copy = AUTH_ERROR_COPY[locale]
      expect(
        new Set([
          copy['auth/user-not-found'],
          copy['auth/wrong-password'],
          copy['auth/invalid-credential']
        ]).size,
        'distinct unknown-email and wrong-password copy is an account enumeration oracle'
      ).toBe(1)
    }
  )
})

describe('authErrorMessage', () => {
  it('returns the coded line for a known code in the requested locale', () => {
    expect(
      authErrorMessage(
        classifyAuthError(firebaseError('auth/popup-blocked')),
        'ja'
      )
    ).toBe(AUTH_ERROR_COPY.ja['auth/popup-blocked'])
  })

  it('falls back to the generic line for an unknown auth code', () => {
    expect(
      authErrorMessage(classifyAuthError(firebaseError('auth/some-new-code')))
    ).toBe(AUTH_ERROR_MESSAGES.generic)
  })

  it('uses the signup-blocked copy regardless of the collapsed code', () => {
    expect(
      authErrorMessage(
        classifyAuthError(
          firebaseError('auth/internal-error', 'SIGNUP_BLOCKED')
        ),
        'zh-CN'
      )
    ).toBe(AUTH_ERROR_COPY['zh-CN'].signupBlocked)
  })

  it.for(['auth/user-not-found', 'auth/wrong-password'] as const)(
    'resolves %s to the invalid-credential line even when a host table distinguishes it',
    (code) => {
      const hostCopy = {
        'auth/user-not-found': 'No account with this email',
        'auth/wrong-password': 'Wrong password',
        'auth/invalid-credential': 'Invalid login credentials.',
        generic: 'host generic',
        signupBlocked: 'host blocked'
      }

      expect(
        authErrorMessage(classifyAuthError(firebaseError(code)), hostCopy),
        'the collapse is the package rule, not a property of its own tables; a host table must not reopen the oracle'
      ).toBe('Invalid login credentials.')
    }
  )

  it('gives the generic line for a non-Firebase failure', () => {
    expect(authErrorMessage(classifyAuthError(new Error('boom')))).toBe(
      AUTH_ERROR_MESSAGES.generic
    )
  })

  it('resolves against a table the host brings instead of a shipped locale', () => {
    const hostCopy = {
      'auth/too-many-requests': 'host slow down',
      generic: 'host generic',
      signupBlocked: 'host blocked'
    }

    expect(
      authErrorMessage(
        classifyAuthError(firebaseError('auth/too-many-requests')),
        hostCopy
      )
    ).toBe('host slow down')
    expect(
      authErrorMessage(
        classifyAuthError(firebaseError('auth/some-new-code')),
        hostCopy
      ),
      'the host table falls back to its own generic line'
    ).toBe('host generic')
  })

  it('does not pretend to know the unauthorized-domain copy without the host values', () => {
    expect(
      authErrorMessage(
        classifyAuthError(firebaseError('auth/unauthorized-domain'))
      ),
      'the domain line needs {domain} and {email}; hosts call unauthorizedDomainMessage'
    ).toBe(AUTH_ERROR_MESSAGES.generic)
  })
})

describe('unauthorizedDomainMessage', () => {
  it('interpolates the host domain and support address', () => {
    expect(
      unauthorizedDomainMessage({
        domain: 'comfy.org',
        email: 'support@comfy.org'
      })
    ).toBe(
      'Your domain comfy.org is not authorized to use this service. Please contact support@comfy.org to add your domain to the whitelist.'
    )
  })

  it.for(['en', 'zh-CN', 'ja'] as const)(
    '%s template carries both placeholders',
    (locale) => {
      expect(UNAUTHORIZED_DOMAIN_MESSAGES[locale]).toContain('{domain}')
      expect(UNAUTHORIZED_DOMAIN_MESSAGES[locale]).toContain('{email}')
    }
  )
})

describe('AUTH_TOAST_SUMMARIES', () => {
  it('pairs every severity with a summary in every locale', () => {
    for (const locale of ['en', 'zh-CN', 'ja'] as const) {
      expect(AUTH_TOAST_SUMMARIES[locale].error).toBeTruthy()
      expect(AUTH_TOAST_SUMMARIES[locale].warn).toBeTruthy()
    }
  })
})
