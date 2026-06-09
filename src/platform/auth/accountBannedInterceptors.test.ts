import axios, { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { onAccountBanned } from '@/platform/auth/accountBanned'
import {
  addAccountBannedInterceptor,
  installAccountBannedFetchInterceptor
} from '@/platform/auth/accountBannedInterceptors'

vi.mock('@/config/comfyApi', () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.org',
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

function bannedResponse(): Response {
  return new Response(JSON.stringify({ code: 'ACCOUNT_BANNED' }), {
    status: 403
  })
}

describe('installAccountBannedFetchInterceptor', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('notifies listeners when one of our cloud hosts returns a banned 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(bannedResponse())
    installAccountBannedFetchInterceptor()
    const onBanned = vi.fn()
    const unsubscribe = onAccountBanned(onBanned)

    await fetch('https://api.comfy.org/customers/balance')
    await vi.waitFor(() => expect(onBanned).toHaveBeenCalledTimes(1))

    unsubscribe()
  })

  it('ignores a banned 403 from a third-party host', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(bannedResponse())
    installAccountBannedFetchInterceptor()
    const onBanned = vi.fn()
    const unsubscribe = onAccountBanned(onBanned)

    await fetch('https://evil.example.com/whatever')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onBanned).not.toHaveBeenCalled()

    unsubscribe()
  })

  it('does not notify for an ordinary 403 and returns the body intact', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'ACCESS_DENIED' }), { status: 403 })
      )
    installAccountBannedFetchInterceptor()
    const onBanned = vi.fn()
    const unsubscribe = onAccountBanned(onBanned)

    const response = await fetch('https://api.comfy.org/customers/balance')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onBanned).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({ code: 'ACCESS_DENIED' })

    unsubscribe()
  })
})

describe('addAccountBannedInterceptor', () => {
  let client: ReturnType<typeof axios.create>

  beforeEach(() => {
    client = axios.create()
    addAccountBannedInterceptor(client)
  })

  it('notifies listeners when a request rejects with a banned 403', async () => {
    client.interceptors.request.use(() =>
      Promise.reject(
        new AxiosError('banned', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 403,
          data: { code: 'ACCOUNT_BANNED' },
          statusText: 'Forbidden',
          headers: {},
          config: { headers: new AxiosHeaders() }
        })
      )
    )
    const onBanned = vi.fn()
    const unsubscribe = onAccountBanned(onBanned)

    await expect(client.get('/whatever')).rejects.toThrow()
    expect(onBanned).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it('does not notify for an ordinary 403 rejection', async () => {
    client.interceptors.request.use(() =>
      Promise.reject(
        new AxiosError('denied', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 403,
          data: { code: 'ACCESS_DENIED' },
          statusText: 'Forbidden',
          headers: {},
          config: { headers: new AxiosHeaders() }
        })
      )
    )
    const onBanned = vi.fn()
    const unsubscribe = onAccountBanned(onBanned)

    await expect(client.get('/whatever')).rejects.toThrow()
    expect(onBanned).not.toHaveBeenCalled()

    unsubscribe()
  })
})
