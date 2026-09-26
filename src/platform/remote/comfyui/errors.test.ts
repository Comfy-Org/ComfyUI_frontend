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

  it('falls back entirely for non-object, non-string bodies', () => {
    for (const body of [undefined, null, 42, true, ['x']]) {
      expect(errorResponseFromBody(body, 'fallback')).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'fallback'
      })
    }
  })

  it('uses a plain-string body as the message', () => {
    expect(errorResponseFromBody('Service Unavailable', 'fallback')).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Service Unavailable'
    })
  })

  it('trims surrounding whitespace off a raw body', () => {
    expect(errorResponseFromBody('  upstream error  ', 'fallback')).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'upstream error'
    })
  })

  it('caps the raw body at the length limit', () => {
    expect(errorResponseFromBody('a'.repeat(500), 'fallback').message).toBe(
      'a'.repeat(500)
    )
    expect(errorResponseFromBody('a'.repeat(501), 'fallback').message).toBe(
      'fallback'
    )
  })

  it('falls back for an oversized raw body instead of dumping it', () => {
    const htmlPage = `<!DOCTYPE html>${'<p>Bad Gateway</p>'.repeat(100)}`
    expect(errorResponseFromBody(htmlPage, 'Bad Gateway')).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Bad Gateway'
    })
  })

  it('keeps prose that merely mentions a bracketed token', () => {
    expect(
      errorResponseFromBody('connection to <backend-01> refused', 'fallback')
        .message
    ).toBe('connection to <backend-01> refused')
  })

  it('falls back for a short markup body instead of rendering it raw', () => {
    for (const page of [
      '<html><body>Unauthorized</body></html>',
      '<!DOCTYPE html><title>502</title>',
      '  </div>'
    ]) {
      expect(errorResponseFromBody(page, 'Bad Gateway')).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Bad Gateway'
      })
    }
  })

  it('falls back for a storage XML error document instead of leaking it', () => {
    const s3Error =
      '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code>' +
      '<Message>Access Denied</Message><BucketName>internal-bucket</BucketName>' +
      '<RequestId>4442587FB7D0A2F9</RequestId><HostId>secret-host</HostId></Error>'
    expect(
      errorResponseFromBody(s3Error, 'Failed to upload file to presigned URL')
    ).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Failed to upload file to presigned URL'
    })
  })

  it('falls back for a truncated JSON body instead of showing the fragment', () => {
    for (const fragment of [
      '{"code":"RATE_LIMITED","mess',
      '[{"message":"first"},',
      '{'
    ]) {
      expect(
        errorResponseFromBody(fragment, 'Failed to publish workflow')
      ).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Failed to publish workflow'
      })
    }
  })

  it('falls back for a blank-string body', () => {
    expect(errorResponseFromBody('   ', 'fallback')).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'fallback'
    })
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
    const nullDetails = errorResponseFromBody(
      { code: 'X', message: 'y', details: null },
      'fallback'
    )
    expect('details' in nullDetails).toBe(false)
  })
})

describe('parseErrorResponse', () => {
  function makeResponse(overrides: {
    text?: () => Promise<string>
    status?: number
    statusText?: string
  }): Response {
    return {
      status: overrides.status ?? 500,
      statusText: overrides.statusText ?? 'Internal Server Error',
      text: overrides.text ?? (async () => '{}')
    } as Response
  }

  it('parses a canonical error body', async () => {
    const response = makeResponse({
      text: async () =>
        JSON.stringify({
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
    const response = makeResponse({
      text: async () => JSON.stringify({ message: 'Nope' })
    })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Nope'
    })
  })

  it('uses a plain-text body as the message', async () => {
    const response = makeResponse({
      text: async () => 'upstream connect error',
      statusText: 'Bad Gateway',
      status: 502
    })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'upstream connect error'
    })
  })

  it('falls back for a body that parses to a JSON primitive', async () => {
    for (const raw of ['42', 'null', 'true', '"   "']) {
      const response = makeResponse({
        text: async () => raw,
        statusText: 'Bad Gateway',
        status: 502
      })
      await expect(parseErrorResponse(response)).resolves.toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Bad Gateway'
      })
    }
  })

  it('falls back to the caller message for a truncated JSON body', async () => {
    const response = makeResponse({
      text: async () => '{"code":"USERNAME_TAKEN","message":"Username alrea',
      statusText: 'Bad Gateway',
      status: 502
    })
    await expect(
      parseErrorResponse(response, 'Failed to create ComfyHub profile')
    ).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Failed to create ComfyHub profile'
    })
  })

  it('falls back to statusText when the body is empty', async () => {
    const response = makeResponse({
      text: async () => '',
      statusText: 'Bad Gateway',
      status: 502
    })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Bad Gateway'
    })
  })

  it('falls back to statusText when the body cannot be read', async () => {
    const response = makeResponse({
      text: async () => {
        throw new TypeError('stream failed')
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
      text: async () => '',
      statusText: '',
      status: 402
    })
    await expect(parseErrorResponse(response)).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'HTTP 402'
    })
  })

  it('prefers a caller-supplied fallback over the status text', async () => {
    const response = makeResponse({
      text: async () => '',
      statusText: 'Bad Gateway',
      status: 502
    })
    await expect(
      parseErrorResponse(response, 'Failed to publish workflow')
    ).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Failed to publish workflow'
    })
  })

  it('still prefers the server message over a caller-supplied fallback', async () => {
    const response = makeResponse({
      text: async () => JSON.stringify({ message: 'Username already taken' })
    })
    await expect(
      parseErrorResponse(response, 'Failed to create ComfyHub profile')
    ).resolves.toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Username already taken'
    })
  })

  it('keeps the code but falls back for message-less JSON bodies', async () => {
    for (const body of [
      JSON.stringify({ code: 'USERNAME_TAKEN' }),
      JSON.stringify({ code: 'USERNAME_TAKEN', message: null }),
      JSON.stringify({ code: 'USERNAME_TAKEN', message: '' })
    ]) {
      const response = makeResponse({ text: async () => body })
      await expect(
        parseErrorResponse(response, 'Failed to create ComfyHub profile')
      ).resolves.toEqual({
        code: 'USERNAME_TAKEN',
        message: 'Failed to create ComfyHub profile'
      })
    }
  })
})
