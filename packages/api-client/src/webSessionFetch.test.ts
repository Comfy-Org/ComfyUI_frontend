import {
  COMFY_CLIENT,
  createRequestAuthorizer
} from '@comfyorg/account-core/requestAuth'
import { describe, expect, it, vi } from 'vitest'

import { fetchOnWebSession } from './webSessionFetch'
import type { WebSessionRequestScope } from './webSessionFetch'

describe('web-session request credentials', () => {
  it.for([
    {
      name: 'relative ingest URL',
      url: '/api/assets/image/content',
      credentials: 'same-origin'
    },
    {
      name: 'absolute same-origin URL',
      url: new URL('/api/assets/image/content', location.href).href,
      credentials: 'same-origin'
    },
    {
      name: 'remote ingest URL',
      url: 'https://testcloud.comfy.org/api/assets/image/content',
      credentials: 'include'
    }
  ] as const)(
    'keeps cookie authentication for $name',
    async ({ url, credentials }) => {
      const send = vi.mocked(fetch).mockResolvedValue(new Response('asset'))
      const scope: WebSessionRequestScope = {
        epoch: 1,
        workspaceId: 'team-workspace',
        session: {
          user: { id: 'user', email: 'user@example.com', emailVerified: true },
          csrfToken: 'csrf-token',
          expiresAt: Number.MAX_SAFE_INTEGER,
          absoluteExpiresAt: Number.MAX_SAFE_INTEGER
        }
      }

      await fetchOnWebSession(url, { method: 'POST', body: 'asset' }, scope, {
        authorize: createRequestAuthorizer({
          getWorkspaceToken: async () => 'unused'
        }),
        refresh: async () => undefined,
        workspaceDenied: vi.fn(),
        ssoRequired: vi.fn()
      })

      expect(send).toHaveBeenCalledWith(url, {
        method: 'POST',
        body: 'asset',
        credentials,
        headers: new Headers({
          'X-Comfy-Client': COMFY_CLIENT,
          'X-Comfy-Workspace-ID': 'team-workspace',
          'X-CSRF-Token': 'csrf-token'
        })
      })
    }
  )
})

describe('a request the server refuses because the session lapsed', () => {
  const scopeFor = (csrfToken: string): WebSessionRequestScope => ({
    epoch: 1,
    session: {
      user: { id: 'user', email: 'user@example.com', emailVerified: true },
      csrfToken,
      expiresAt: Number.MAX_SAFE_INTEGER,
      absoluteExpiresAt: Number.MAX_SAFE_INTEGER
    }
  })

  function sendLapsed(
    retriesLapsedSession: boolean,
    init: RequestInit = { method: 'POST', body: '{}' }
  ) {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json(
          { code: 'UNAUTHORIZED', message: 'authentication required' },
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(new Response('restored'))
    const refresh = vi.fn(async () => scopeFor('fresh-csrf'))
    const ports = {
      authorize: createRequestAuthorizer({
        getWorkspaceToken: async () => 'unused'
      }),
      refresh,
      workspaceDenied: vi.fn(),
      ssoRequired: vi.fn(),
      retriesLapsedSession
    }
    const response = fetchOnWebSession(
      '/api/billing/capabilities',
      init,
      scopeFor('stale-csrf'),
      ports
    )
    return { response, refresh }
  }

  it('returns the refusal without re-reading the session when recovery is off', async () => {
    const { response, refresh } = sendLapsed(false)

    expect((await response).status).toBe(401)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('re-reads the session and retries once on the restored session', async () => {
    const { response, refresh } = sendLapsed(true)

    expect(await (await response).text()).toBe('restored')
    expect(refresh).toHaveBeenCalledOnce()
    expect(
      new Headers(vi.mocked(fetch).mock.lastCall?.[1]?.headers).get(
        'X-CSRF-Token'
      )
    ).toBe('fresh-csrf')
  })

  it('returns the refusal for a streamed body it cannot replay', async () => {
    const { response, refresh } = sendLapsed(true, {
      method: 'POST',
      body: new ReadableStream()
    })

    expect((await response).status).toBe(401)
    expect(refresh).not.toHaveBeenCalled()
  })
})
