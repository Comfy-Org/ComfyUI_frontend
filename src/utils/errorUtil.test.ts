import { describe, expect, it } from 'vitest'

import {
  errorResponseFromBody,
  getErrorMessage,
  parseErrorResponse,
  toError
} from './errorUtil'

describe('toError', () => {
  it('returns the same Error instance when given an Error', () => {
    const err = new Error('boom')
    expect(toError(err)).toBe(err)
  })

  it('preserves Error subclasses', () => {
    class CustomError extends Error {}
    const err = new CustomError('subclass')
    expect(toError(err)).toBe(err)
    expect(toError(err)).toBeInstanceOf(CustomError)
  })

  it('wraps a string as an Error message', () => {
    const result = toError('plain string')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('plain string')
  })

  it('wraps a number by stringifying it', () => {
    const result = toError(42)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })

  it('wraps an object via JSON.stringify', () => {
    const result = toError({ code: 'EBOOM', detail: 'nope' })
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('{"code":"EBOOM","detail":"nope"}')
  })

  it('falls back to String() when JSON.stringify throws (circular)', () => {
    const obj: Record<string, unknown> = {}
    obj.self = obj
    const result = toError(obj)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('[object Object]')
  })

  it('handles null and undefined', () => {
    expect(toError(null).message).toBe('null')
    expect(toError(undefined).message).toBe('undefined')
  })
})

describe('getErrorMessage', () => {
  it('returns the message of an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns the value when given a string', () => {
    expect(getErrorMessage('text')).toBe('text')
  })

  it('returns the message field of a plain object', () => {
    expect(getErrorMessage({ message: 'from object' })).toBe('from object')
  })

  it('returns undefined for objects without a string message', () => {
    expect(getErrorMessage({ code: 1 })).toBeUndefined()
    expect(getErrorMessage({ message: 42 })).toBeUndefined()
  })

  it('returns undefined for null, undefined, numbers, booleans', () => {
    expect(getErrorMessage(null)).toBeUndefined()
    expect(getErrorMessage(undefined)).toBeUndefined()
    expect(getErrorMessage(42)).toBeUndefined()
    expect(getErrorMessage(true)).toBeUndefined()
  })
})

describe('errorResponseFromBody', () => {
  it('passes through a canonical body with details', () => {
    const body = {
      code: 'FILE_TOO_LARGE',
      message: 'File too large',
      details: { max_bytes: 1024 }
    }
    expect(errorResponseFromBody(body, 'fallback')).toEqual(body)
  })

  it('passes through a canonical body without details', () => {
    const result = errorResponseFromBody(
      { code: 'NOT_FOUND', message: 'Asset not found' },
      'fallback'
    )
    expect(result).toEqual({ code: 'NOT_FOUND', message: 'Asset not found' })
    expect('details' in result).toBe(false)
  })

  it('salvages a legacy message-only body', () => {
    expect(errorResponseFromBody({ message: 'Forbidden' }, 'fallback')).toEqual(
      {
        code: 'UNKNOWN_ERROR',
        message: 'Forbidden'
      }
    )
  })

  it('salvages a code-only body using the fallback message', () => {
    expect(errorResponseFromBody({ code: 'RATE_LIMITED' }, 'fallback')).toEqual(
      {
        code: 'RATE_LIMITED',
        message: 'fallback'
      }
    )
  })

  it('falls back entirely for non-object bodies', () => {
    for (const body of [undefined, null, 'oops', 42, true, ['x']]) {
      expect(errorResponseFromBody(body, 'fallback')).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'fallback'
      })
    }
  })

  it('treats empty-string code and message as missing', () => {
    expect(
      errorResponseFromBody({ code: '', message: '' }, 'fallback')
    ).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'fallback'
    })
  })

  it('ignores non-string code and message values', () => {
    expect(
      errorResponseFromBody({ code: 42, message: {} }, 'fallback')
    ).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'fallback'
    })
  })

  it('drops non-object details', () => {
    const result = errorResponseFromBody(
      { code: 'X', message: 'y', details: 'not an object' },
      'fallback'
    )
    expect('details' in result).toBe(false)
    const arrayDetails = errorResponseFromBody(
      { code: 'X', message: 'y', details: [1, 2] },
      'fallback'
    )
    expect('details' in arrayDetails).toBe(false)
  })
})

describe('parseErrorResponse', () => {
  const makeResponse = (overrides: {
    json?: () => Promise<unknown>
    status?: number
    statusText?: string
  }): Response =>
    ({
      status: overrides.status ?? 500,
      statusText: overrides.statusText ?? 'Internal Server Error',
      json: overrides.json ?? (async () => ({}))
    }) as Response

  it('parses a canonical error body', async () => {
    const response = makeResponse({
      json: async () => ({
        code: 'INVALID_INPUT',
        message: 'Bad field',
        details: { field: 'name' }
      })
    })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'INVALID_INPUT',
      message: 'Bad field',
      details: { field: 'name' }
    })
  })

  it('salvages a legacy message-only body', async () => {
    const response = makeResponse({ json: async () => ({ message: 'Nope' }) })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Nope'
    })
  })

  it('falls back to statusText when the body is not JSON', async () => {
    const response = makeResponse({
      json: async () => {
        throw new SyntaxError('not json')
      },
      statusText: 'Bad Gateway',
      status: 502
    })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Bad Gateway'
    })
  })

  it('falls back to the status code when statusText is empty', async () => {
    const response = makeResponse({
      json: async () => {
        throw new SyntaxError('not json')
      },
      statusText: '',
      status: 402
    })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'HTTP 402'
    })
  })
})
