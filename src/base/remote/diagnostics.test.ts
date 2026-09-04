import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { summarizeError, summarizePayload } from '@/base/remote/diagnostics'

describe('summarizeError', () => {
  it('extracts message, code and status from an axios error', () => {
    const err = new AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        status: 500,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: null
      }
    )
    expect(summarizeError(err)).toEqual({
      message: 'Request failed',
      code: 'ERR_BAD_RESPONSE',
      status: 500
    })
  })

  it('does not include axios config, headers, request or response data', () => {
    const authedConfig = {
      url: '/voices',
      method: 'get',
      headers: new AxiosHeaders({ Authorization: 'Bearer SECRET-TOKEN-123' })
    }
    const err = new AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      authedConfig,
      undefined,
      {
        status: 500,
        statusText: '',
        headers: { 'set-cookie': ['session=PRIVATE'] },
        config: authedConfig,
        data: { user_email: 'private@example.com' }
      }
    )
    const summary = summarizeError(err)

    expect(JSON.stringify(summary)).not.toContain('SECRET-TOKEN-123')
    expect(JSON.stringify(summary)).not.toContain('PRIVATE')
    expect(JSON.stringify(summary)).not.toContain('private@example.com')
    expect(summary).not.toHaveProperty('config')
    expect(summary).not.toHaveProperty('request')
    expect(summary).not.toHaveProperty('response')
  })

  it('reports an axios network error with no response as undefined status', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK')
    expect(summarizeError(err)).toEqual({
      message: 'Network Error',
      code: 'ERR_NETWORK',
      status: undefined
    })
  })

  it('summarizes a plain Error using its name and message', () => {
    expect(summarizeError(new TypeError('boom'))).toEqual({
      message: 'boom',
      name: 'TypeError'
    })
  })

  it('coerces non-Error throwables to a message string', () => {
    expect(summarizeError('oops')).toEqual({ message: 'oops' })
    expect(summarizeError(42)).toEqual({ message: '42' })
    expect(summarizeError(null)).toEqual({ message: 'null' })
    expect(summarizeError(undefined)).toEqual({ message: 'undefined' })
  })
})

describe('summarizePayload', () => {
  it('reports array length without exposing values', () => {
    expect(
      summarizePayload([{ secret: 'a' }, { secret: 'b' }, { secret: 'c' }])
    ).toEqual({
      type: 'array',
      length: 3
    })
  })

  it('reports object keys without exposing values', () => {
    expect(
      summarizePayload({ user_email: 'private@example.com', voices: ['x'] })
    ).toEqual({
      type: 'object',
      keys: ['user_email', 'voices'],
      keyCount: 2
    })
  })

  it('caps the keys sample at 10 but reports the full key count', () => {
    const big: Record<string, number> = {}
    for (let i = 0; i < 25; i++) big[`k${i}`] = i
    const summary = summarizePayload(big) as {
      type: string
      keys: string[]
      keyCount: number
    }
    expect(summary.type).toBe('object')
    expect(summary.keys).toHaveLength(10)
    expect(summary.keyCount).toBe(25)
  })

  it('distinguishes null and undefined', () => {
    expect(summarizePayload(null)).toEqual({ type: 'null' })
    expect(summarizePayload(undefined)).toEqual({ type: 'undefined' })
  })

  it('reports primitive types without their value', () => {
    expect(summarizePayload('hello')).toEqual({ type: 'string' })
    expect(summarizePayload(123)).toEqual({ type: 'number' })
    expect(summarizePayload(true)).toEqual({ type: 'boolean' })
  })
})
