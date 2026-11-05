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
