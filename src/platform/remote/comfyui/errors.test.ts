import { describe, expect, it } from 'vitest'

import { errorResponseFromBody, parseErrorResponse } from './errors'

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
