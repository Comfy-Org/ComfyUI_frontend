vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/scripts/api'))
const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import type { AuthCredential, AuthHeader } from '@/types/authTypes'

import { agentSocketParams, ensureSignedIn, withAgentAuth } from './agentAuth'

beforeEach(() => {
  distribution.isCloud = false
})

function userHeader(header: AuthHeader | null): void {
  vi.spyOn(useAuthStore(), 'getUserAuthHeader').mockResolvedValue(header)
}

describe('withAgentAuth', () => {
  it.for<{
    account: string
    header: AuthHeader
    name: string
    value: string
    credential: AuthCredential
  }>([
    {
      account: 'a signed-in session',
      header: { Authorization: 'Bearer id-token' },
      name: 'Authorization',
      value: 'Bearer id-token',
      credential: 'bearer'
    },
    {
      account: 'an API-key session',
      header: { 'X-API-KEY': 'comfyui-key' },
      name: 'X-API-KEY',
      value: 'comfyui-key',
      credential: 'api-key'
    }
  ])(
    "sends $account's user auth header, keeping the request's own",
    async ({ header, name, value, credential }) => {
      userHeader(header)
      const reported: AuthCredential[] = []

      const init = await withAgentAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        onAuthCredential: (kind) => reported.push(kind)
      })
      init.onAuthCredential('none')

      const headers = new Headers(init.headers)
      expect(headers.get(name)).toBe(value)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(init.method).toBe('POST')
      expect(init.redirect).toBe('error')
      expect(reported).toEqual([credential])
    }
  )

  it('leaves a cloud request to fetchApi, never attaching the personal token', async () => {
    distribution.isCloud = true
    userHeader({ Authorization: 'Bearer personal-id-token' })

    const init = await withAgentAuth({ method: 'GET' })

    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(init.redirect).toBeUndefined()
  })

  it('sends nothing and leaves the redirect policy alone for a signed-out user', async () => {
    userHeader(null)

    const init = await withAgentAuth({ method: 'GET' })

    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(new Headers(init.headers).has('X-API-KEY')).toBe(false)
    expect(init.redirect).toBeUndefined()
  })
})

describe('agentSocketParams', () => {
  it.for<{ label: string; header: AuthHeader; token: string }>([
    {
      label: 'a bearer token',
      header: { Authorization: 'Bearer id-token' },
      token: 'id-token'
    },
    {
      label: 'an API key',
      header: { 'X-API-KEY': 'comfyui-key' },
      token: 'comfyui-key'
    }
  ])(
    'passes the user credential as the token off-cloud: $label',
    async ({ header, token }) => {
      userHeader(header)

      expect((await agentSocketParams()).get('token')).toBe(token)
    }
  )

  it('connects without a token when signed out', async () => {
    userHeader(null)

    expect((await agentSocketParams()).has('token')).toBe(false)
  })

  it('authenticates a cloud socket the way /ws does, never with the personal token', async () => {
    distribution.isCloud = true
    userHeader({ Authorization: 'Bearer personal-id-token' })
    vi.mocked(api.addSocketAuth).mockImplementation(async (params) => {
      params.set('workspace_id', 'ws-1')
      return true
    })

    const params = await agentSocketParams()

    expect(params.get('workspace_id')).toBe('ws-1')
    expect(params.has('token')).toBe(false)
  })
})

describe('ensureSignedIn', () => {
  it('lets a signed-in user send without asking', async () => {
    userHeader({ Authorization: 'Bearer id-token' })

    await expect(ensureSignedIn()).resolves.toBe(true)
    expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
  })

  it('asks a signed-out user to sign in and holds the turn if they decline', async () => {
    userHeader(null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValue(false)

    await expect(ensureSignedIn()).resolves.toBe(false)
    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
  })

  it('sends once the sign-in dialog produced a session', async () => {
    const spy = vi
      .spyOn(useAuthStore(), 'getUserAuthHeader')
      .mockResolvedValue(null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementation(
      async () => {
        spy.mockResolvedValue({ Authorization: 'Bearer fresh-token' })
        return true
      }
    )

    await expect(ensureSignedIn()).resolves.toBe(true)
  })

  it('holds the turn when the sign-in dialog fails to open', async () => {
    userHeader(null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockRejectedValue(
      new Error('chunk failed')
    )

    await expect(ensureSignedIn()).resolves.toBe(false)
  })

  it.for([
    { mode: 'development', proxyCredential: 'true', asks: false },
    { mode: 'development', proxyCredential: '', asks: true },
    { mode: 'production', proxyCredential: 'true', asks: true }
  ])(
    'asks a signed-out user to sign in: $asks (mode $mode, proxy credential "$proxyCredential")',
    async ({ mode, proxyCredential, asks }) => {
      vi.stubEnv('MODE', mode)
      vi.stubEnv('VITE_DEV_AGENT_PROXY_CREDENTIAL', proxyCredential)
      userHeader(null)

      await ensureSignedIn()

      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledTimes(
        asks ? 1 : 0
      )
    }
  )
})
