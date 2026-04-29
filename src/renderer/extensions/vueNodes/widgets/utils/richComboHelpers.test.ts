import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import type { RemoteComboConfig } from '@/schemas/nodeDefSchema'

import {
  buildCacheKey,
  getBackoff,
  isRetriableError,
  summarizeError,
  summarizePayload
} from '@/renderer/extensions/vueNodes/widgets/utils/richComboHelpers'

const baseConfig: RemoteComboConfig = {
  route: '/voices',
  item_schema: {
    value_field: 'id',
    label_field: 'name',
    preview_type: 'image'
  }
}

function parseKey(key: string): URLSearchParams {
  return new URL(key).searchParams
}

describe('buildCacheKey', () => {
  it('encodes the route and response_key', () => {
    const params = parseKey(
      buildCacheKey(
        {
          ...baseConfig,
          route: '/voices',
          response_key: 'data.items'
        },
        'fb:user-a'
      )
    )
    expect(params.get('route')).toBe('/voices')
    expect(params.get('responseKey')).toBe('data.items')
  })

  it('partitions by authScope', () => {
    const a = buildCacheKey(baseConfig, 'ws:team-a')
    const b = buildCacheKey(baseConfig, 'ws:team-b')
    expect(a).not.toBe(b)
    expect(parseKey(a).get('u')).toBe('ws:team-a')
    expect(parseKey(b).get('u')).toBe('ws:team-b')
  })

  it('treats workspace, firebase, and api-key scopes as distinct buckets', () => {
    const ws = buildCacheKey(baseConfig, 'ws:abc')
    const fb = buildCacheKey(baseConfig, 'fb:abc')
    const apikey = buildCacheKey(baseConfig, 'apikey')
    expect(new Set([ws, fb, apikey]).size).toBe(3)
  })

  it('falls back to "anon" when authScope is missing', () => {
    expect(parseKey(buildCacheKey(baseConfig, null)).get('u')).toBe('anon')
    expect(parseKey(buildCacheKey(baseConfig, undefined)).get('u')).toBe('anon')
  })

  it('treats missing optional fields as empty so the key stays stable', () => {
    const params = parseKey(buildCacheKey(baseConfig, 'fb:user-a'))
    expect(params.get('responseKey')).toBe('')
  })
})

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
