import type { AxiosAdapter } from 'axios'
import axios, { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachUnifiedRemintInterceptor,
  fetchWithUnifiedRemint
} from '@/platform/auth/unified/remintRetry'

const { mockRemint, flagState } = vi.hoisted(() => ({
  mockRemint: vi.fn(),
  flagState: { unifiedCloudAuthEnabled: true }
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ remintUnifiedOnce: mockRemint })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get unifiedCloudAuthEnabled() {
        return flagState.unifiedCloudAuthEnabled
      }
    }
  })
}))

// The axios interceptor gates on shouldRemintCloudRequest(), which is a no-op
// off-cloud; the unit env is not a cloud build, so force it on.
vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

describe('fetchWithUnifiedRemint', () => {
  const ok = { status: 200 } as Response
  const unauthorized = { status: 401 } as Response
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRemint.mockReset()
    flagState.unifiedCloudAuthEnabled = true
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('re-mints once and retries with the fresh token on a 401 (AC1)', async () => {
    mockFetch.mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(ok)
    mockRemint.mockResolvedValue('tokenB')

    const result = await fetchWithUnifiedRemint(
      'https://cloud/x',
      { headers: { Authorization: 'Bearer tokenA', 'Comfy-User': 'u1' } },
      true
    )

    expect(result).toBe(ok)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockRemint).toHaveBeenCalledTimes(1)

    const retryHeaders = new Headers(mockFetch.mock.calls[1][1].headers)
    expect(retryHeaders.get('Authorization')).toBe('Bearer tokenB')
    expect(retryHeaders.get('Comfy-User')).toBe('u1')
  })

  it('surfaces a persistent 401 after exactly one retry (AC2)', async () => {
    const secondUnauthorized = { status: 401 } as Response
    mockFetch
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(secondUnauthorized)
    mockRemint.mockResolvedValue('tokenB')

    const result = await fetchWithUnifiedRemint(
      'https://cloud/x',
      { headers: { Authorization: 'Bearer tokenA' } },
      true
    )

    expect(result).toBe(secondUnauthorized)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockRemint).toHaveBeenCalledTimes(1)
  })

  it('does not re-mint or retry when the caller gate is false (AC3)', async () => {
    mockFetch.mockResolvedValueOnce(unauthorized)

    const result = await fetchWithUnifiedRemint(
      'https://cloud/x',
      { headers: { Authorization: 'Bearer tokenA' } },
      false
    )

    expect(result).toBe(unauthorized)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockRemint).not.toHaveBeenCalled()
  })

  it('does not retry a non-401 response', async () => {
    const serverError = { status: 500 } as Response
    mockFetch.mockResolvedValueOnce(serverError)

    const result = await fetchWithUnifiedRemint(
      'https://cloud/x',
      { headers: { Authorization: 'Bearer t' } },
      true
    )

    expect(result).toBe(serverError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockRemint).not.toHaveBeenCalled()
  })

  it('surfaces the original 401 when the re-mint yields no token', async () => {
    mockFetch.mockResolvedValueOnce(unauthorized)
    mockRemint.mockResolvedValue(null)

    const result = await fetchWithUnifiedRemint(
      'https://cloud/x',
      { headers: { Authorization: 'Bearer t' } },
      true
    )

    expect(result).toBe(unauthorized)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockRemint).toHaveBeenCalledTimes(1)
  })

  it('surfaces the original 401 when the re-mint throws a permanent auth error', async () => {
    mockFetch.mockResolvedValueOnce(unauthorized)
    mockRemint.mockRejectedValue(new Error('INVALID_FIREBASE_TOKEN'))

    const result = await fetchWithUnifiedRemint(
      'https://cloud/x',
      { headers: { Authorization: 'Bearer t' } },
      true
    )

    expect(result).toBe(unauthorized)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockRemint).toHaveBeenCalledTimes(1)
  })

  it('surfaces the original 401 without re-minting when the body is a non-replayable stream', async () => {
    mockFetch.mockResolvedValueOnce(unauthorized)
    mockRemint.mockResolvedValue('tokenB')

    const result = await fetchWithUnifiedRemint(
      'https://cloud/x',
      {
        method: 'POST',
        body: new ReadableStream<Uint8Array>(),
        headers: { Authorization: 'Bearer tokenA' }
      },
      true
    )

    expect(result).toBe(unauthorized)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockRemint).not.toHaveBeenCalled()
  })

  it.for([
    {
      shape: 'object',
      headers: { Authorization: 'Bearer tokenA', 'Comfy-User': 'u1' }
    },
    {
      shape: 'array of tuples',
      headers: [
        ['Authorization', 'Bearer tokenA'],
        ['Comfy-User', 'u1']
      ]
    },
    {
      shape: 'Headers',
      headers: new Headers({
        Authorization: 'Bearer tokenA',
        'Comfy-User': 'u1'
      })
    }
  ] as { shape: string; headers: HeadersInit }[])(
    'preserves method/body and replaces Authorization on a POST retry ($shape headers)',
    async ({ headers }) => {
      mockFetch.mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(ok)
      mockRemint.mockResolvedValue('tokenB')
      const body = JSON.stringify({ amount: 5 })

      await fetchWithUnifiedRemint(
        'https://cloud/x',
        { method: 'POST', body, headers },
        true
      )

      const retryInit = mockFetch.mock.calls[1][1]
      expect(retryInit.method).toBe('POST')
      expect(retryInit.body).toBe(body)
      const retryHeaders = new Headers(retryInit.headers)
      expect(retryHeaders.get('Authorization')).toBe('Bearer tokenB')
      expect(retryHeaders.get('Comfy-User')).toBe('u1')
    }
  )
})

describe('attachUnifiedRemintInterceptor', () => {
  beforeEach(() => {
    mockRemint.mockReset()
    flagState.unifiedCloudAuthEnabled = true
  })

  // A custom axios adapter is responsible for its own status handling (axios
  // only applies validateStatus inside its built-in adapters), so reject
  // non-2xx with a real AxiosError to mirror a live response.
  function makeAdapter(statuses: number[]): ReturnType<typeof vi.fn> {
    let call = 0
    return vi.fn<AxiosAdapter>(async (config) => {
      const status = statuses[Math.min(call, statuses.length - 1)]
      call++
      const response = {
        data: status === 200 ? { ok: true } : { message: 'unauthorized' },
        status,
        statusText: String(status),
        headers: {},
        config
      }
      if (status >= 200 && status < 300) {
        return response
      }
      throw new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response
      )
    })
  }

  function makeClient(statuses: number[]) {
    const adapter = makeAdapter(statuses)
    const client = axios.create({ adapter: adapter as unknown as AxiosAdapter })
    attachUnifiedRemintInterceptor(client)
    return { client, adapter }
  }

  it('re-mints once and retries the request with the fresh token (AC1)', async () => {
    const { client, adapter } = makeClient([401, 200])
    mockRemint.mockResolvedValue('tokenB')

    const res = await client.get('https://cloud/x', {
      headers: { Authorization: 'Bearer tokenA' }
    })

    expect(res.status).toBe(200)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(mockRemint).toHaveBeenCalledTimes(1)
    expect(String(adapter.mock.calls[1][0].headers.Authorization)).toBe(
      'Bearer tokenB'
    )
  })

  it('retries once then surfaces a persistent 401 (AC2)', async () => {
    const { client, adapter } = makeClient([401, 401])
    mockRemint.mockResolvedValue('tokenB')

    await expect(
      client.get('https://cloud/x', {
        headers: { Authorization: 'Bearer tokenA' }
      })
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(adapter).toHaveBeenCalledTimes(2)
    expect(mockRemint).toHaveBeenCalledTimes(1)
  })

  it('does not re-mint when the flag is OFF (AC3)', async () => {
    flagState.unifiedCloudAuthEnabled = false
    const { client, adapter } = makeClient([401])

    await expect(
      client.get('https://cloud/x', {
        headers: { Authorization: 'Bearer tokenA' }
      })
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(adapter).toHaveBeenCalledTimes(1)
    expect(mockRemint).not.toHaveBeenCalled()
  })

  it('does not re-mint a request flagged __skipUnifiedRemint (acceptInvite)', async () => {
    const { client, adapter } = makeClient([401])
    mockRemint.mockResolvedValue('tokenB')

    await expect(
      client.post('https://cloud/invites/x/accept', null, {
        headers: { Authorization: 'Bearer firebase' },
        __skipUnifiedRemint: true
      })
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(adapter).toHaveBeenCalledTimes(1)
    expect(mockRemint).not.toHaveBeenCalled()
  })

  it('passes a non-401 error through without re-minting', async () => {
    const { client } = makeClient([500])

    await expect(
      client.get('https://cloud/x', { headers: { Authorization: 'Bearer t' } })
    ).rejects.toMatchObject({ response: { status: 500 } })

    expect(mockRemint).not.toHaveBeenCalled()
  })

  it('preserves the POST body and method on a retry, with the fresh token', async () => {
    const { client, adapter } = makeClient([401, 200])
    mockRemint.mockResolvedValue('tokenB')

    const res = await client.post(
      'https://cloud/topup',
      { amount: 5 },
      { headers: { Authorization: 'Bearer tokenA' } }
    )

    expect(res.status).toBe(200)
    expect(adapter).toHaveBeenCalledTimes(2)
    const firstConfig = adapter.mock.calls[0][0]
    const retryConfig = adapter.mock.calls[1][0]
    expect(retryConfig.method).toBe('post')
    expect(retryConfig.data).toBe(firstConfig.data)
    expect(String(retryConfig.headers.Authorization)).toBe('Bearer tokenB')
  })

  it('latches per request — a second request still retries once (no shared latch)', async () => {
    // Per-URL: first call 401, second (the retry) 200. The latch lives on each
    // request's config, so a second request must retry independently.
    const callsByUrl = new Map<string, number>()
    const adapter = vi.fn<AxiosAdapter>(async (config) => {
      const url = config.url ?? ''
      const nth = (callsByUrl.get(url) ?? 0) + 1
      callsByUrl.set(url, nth)
      const okStatus = nth >= 2
      const response = {
        data: okStatus ? { ok: true } : { message: 'unauthorized' },
        status: okStatus ? 200 : 401,
        statusText: okStatus ? '200' : '401',
        headers: {},
        config
      }
      if (okStatus) return response
      throw new AxiosError(
        'Request failed with status code 401',
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response
      )
    })
    const client = axios.create({ adapter: adapter as unknown as AxiosAdapter })
    attachUnifiedRemintInterceptor(client)
    mockRemint.mockResolvedValue('tokenB')

    const a = await client.get('https://cloud/a', {
      headers: { Authorization: 'Bearer tokenA' }
    })
    const b = await client.get('https://cloud/b', {
      headers: { Authorization: 'Bearer tokenA' }
    })

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    // Each request: initial 401 + one retry = 4 adapter calls, one re-mint each.
    expect(adapter).toHaveBeenCalledTimes(4)
    expect(mockRemint).toHaveBeenCalledTimes(2)
  })
})
