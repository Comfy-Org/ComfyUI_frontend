import { describe, expect, it } from 'vitest'

import {
  MAX_ACCEPTED_METHODS,
  MAX_REASON_TEXT_LENGTH,
  authRejectionTags,
  isAuthRejectionStatus
} from './authRejection'

const NOT_ALLOWED_MESSAGE =
  'Authentication method not allowed for this endpoint. Accepted: bearer_jwt, x_api_key'

describe('isAuthRejectionStatus', () => {
  it.for([
    [401, true],
    [403, true],
    [400, false],
    [404, false],
    [500, false]
  ] as const)('%i -> %s', ([status, expected]) => {
    expect(isAuthRejectionStatus(status)).toBe(expected)
  })
})

describe('authRejectionTags', () => {
  it('describes an auth-type refusal from its structure', () => {
    expect(
      authRejectionTags(
        {
          accepted: ['bearer_jwt', 'x_api_key'],
          error: { type: 'auth_type_not_allowed', message: NOT_ALLOWED_MESSAGE }
        },
        NOT_ALLOWED_MESSAGE
      )
    ).toEqual({
      backendReason: 'auth_method_not_allowed',
      backendErrorType: 'auth_type_not_allowed',
      acceptedMethods: 'bearer_jwt,x_api_key'
    })
  })

  it('classifies the plain { error: string } shape from the message', () => {
    expect(
      authRejectionTags({ error: NOT_ALLOWED_MESSAGE }, NOT_ALLOWED_MESSAGE)
    ).toEqual({ backendReason: 'auth_method_not_allowed' })
  })

  it('reads the ingest { code, message } shape, preferring its message', () => {
    expect(
      authRejectionTags({ code: 'UNAUTHORIZED', message: 'no credential' }, '')
    ).toEqual({ backendReason: 'other', backendErrorCode: 'UNAUTHORIZED' })
  })

  it.for([
    'user 3f2b8c1e-9a4d-4e57-8b1a-0c6d2f7e5a91 not authorized for workspace 7d1e4b2a-5c3f-4a68-9e0b-1f2a3b4c5d6e',
    'invalid key 9f86d081884c7d659a2feaa0c55ad015',
    'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc rejected',
    'denied for someone@example.com'
  ])('reports no part of free-form text: %s', (text) => {
    const tags = authRejectionTags({ error: text }, text)

    expect(tags).toEqual({ backendReason: 'other' })
  })

  it('never copies an unknown code or method into a tag', () => {
    const tags = authRejectionTags(
      {
        code: 'ws_7d1e4b2a5c3f4a689e0b1f2a3b4c5d6e',
        message: 'nope'
      },
      ''
    )
    const methods = authRejectionTags(
      {
        accepted: ['bearer_jwt', 'custom-7d1e4b2a', 'x_api_key', 'again'],
        error: { type: 'auth_type_not_allowed', message: 'nope' }
      },
      'nope'
    )

    expect(tags.backendErrorCode).toBe('other')
    expect(methods.acceptedMethods).toBe('bearer_jwt,other,x_api_key')
  })

  it('reads only the first MAX_ACCEPTED_METHODS accepted methods', () => {
    const accepted = [
      ...Array.from({ length: MAX_ACCEPTED_METHODS }, () => 'unlisted'),
      'bearer_jwt'
    ]

    const tags = authRejectionTags(
      { accepted, error: { type: 'auth_type_not_allowed', message: 'x' } },
      'x'
    )

    expect(tags.acceptedMethods).toBe('other')
  })

  it('reads only a bounded prefix of the message', () => {
    const text = `${' '.repeat(MAX_REASON_TEXT_LENGTH)}authentication method not allowed`

    expect(authRejectionTags(undefined, text)).toEqual({})
  })

  it.for([
    undefined,
    null,
    0,
    'text',
    [],
    [1, 2],
    {},
    { error: null },
    { error: { type: 5 } },
    { accepted: 'bearer_jwt' },
    { code: 403, message: 7 }
  ])('is total for the hostile body %j', (body) => {
    expect(() => authRejectionTags(body, '')).not.toThrow()
  })
})
