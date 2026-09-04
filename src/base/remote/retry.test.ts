import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { getBackoff, isRetriableError } from '@/base/remote/retry'

describe('getBackoff', () => {
  it('grows exponentially from 1s', () => {
    expect(getBackoff(1)).toBe(2000)
    expect(getBackoff(2)).toBe(4000)
    expect(getBackoff(3)).toBe(8000)
    expect(getBackoff(4)).toBe(16000)
  })

  it('caps at 16s for higher attempt counts', () => {
    expect(getBackoff(5)).toBe(16000)
    expect(getBackoff(10)).toBe(16000)
    expect(getBackoff(100)).toBe(16000)
  })
})

describe('isRetriableError', () => {
  function axiosErrorWithStatus(status: number): AxiosError {
    return new AxiosError(
      `HTTP ${status}`,
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        status,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: null
      }
    )
  }

  it('retries non-axios errors (e.g. unexpected throws)', () => {
    expect(isRetriableError(new Error('boom'))).toBe(true)
    expect(isRetriableError('string error')).toBe(true)
    expect(isRetriableError(undefined)).toBe(true)
  })

  it('retries axios errors with no response (network failures)', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK')
    expect(isRetriableError(err)).toBe(true)
  })

  it('does not retry canceled axios requests (ERR_CANCELED)', () => {
    const err = new AxiosError('canceled', 'ERR_CANCELED')
    expect(isRetriableError(err)).toBe(false)
  })

  it('retries 5xx responses', () => {
    expect(isRetriableError(axiosErrorWithStatus(500))).toBe(true)
    expect(isRetriableError(axiosErrorWithStatus(502))).toBe(true)
    expect(isRetriableError(axiosErrorWithStatus(503))).toBe(true)
  })

  it('retries 408 (request timeout) and 429 (too many requests)', () => {
    expect(isRetriableError(axiosErrorWithStatus(408))).toBe(true)
    expect(isRetriableError(axiosErrorWithStatus(429))).toBe(true)
  })

  it('does not retry other 4xx responses', () => {
    expect(isRetriableError(axiosErrorWithStatus(400))).toBe(false)
    expect(isRetriableError(axiosErrorWithStatus(401))).toBe(false)
    expect(isRetriableError(axiosErrorWithStatus(403))).toBe(false)
    expect(isRetriableError(axiosErrorWithStatus(404))).toBe(false)
  })
})
