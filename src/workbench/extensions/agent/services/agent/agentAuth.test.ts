vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/scripts/api'))
const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import type { AuthCredential, AuthHeader, AuthScheme } from '@/types/authTypes'

import {
  agentSocketAuthParams,
  ensureSignedIn,
  withAgentAuth
} from './agentAuth'

beforeEach(() => {
  distribution.isCloud = false
})

function userHeader(header: AuthHeader | null): void {
  vi.spyOn(useAuthStore(), 'getUserAuthHeader').mockResolvedValue(header)
}

function workspaceToken(token: string | undefined | Error): void {
  const spy = vi.spyOn(useAuthStore(), 'getWorkspaceAuthTokenOrThrow')
  if (token instanceof Error) spy.mockRejectedValue(token)
  else if (token === undefined)
    spy.mockRejectedValue(new AuthStoreError('not authenticated'))
  else spy.mockResolvedValue(token)
}

function storedApiKey(key: string): void {
  Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
  vi.spyOn(useApiKeyAuthStore(), 'getAuthHeader').mockReturnValue({
    'X-API-KEY': key
  })
}

function signInPersonal(): void {
  useAuthStore().currentUser = fromPartial<User>({ uid: 'user-a' })
  userHeader({ Authorization: 'Bearer personal-id-token' })
}

const missingWorkspaceTokens = [
  { label: 'no workspace token', token: undefined, apiKey: false },
  {
    label: 'a workspace token that failed to mint',
    token: new Error('token exchange failed'),
    apiKey: false
  },
  {
    label: 'no workspace token and a stored API key',
    token: undefined,
    apiKey: true
  }
]

function signInWithout(token: undefined | Error, apiKey: boolean) {
  signInPersonal()
  if (apiKey) storedApiKey('comfyui-key')
  workspaceToken(token)
}

describe('withAgentAuth', () => {
  it.for<{
    account: string
    signIn: () => void
    name: string
    value: string
    credential: AuthCredential
  }>([
    {
      account: 'a workspace session',
      signIn: () => {
        signInPersonal()
        workspaceToken('workspace-token')
      },
      name: 'Authorization',
      value: 'Bearer workspace-token',
      credential: 'bearer'
    },
    {
      account: 'an API-key session',
      signIn: () => storedApiKey('comfyui-key'),
      name: 'X-API-KEY',
      value: 'comfyui-key',
      credential: 'api-key'
    }
  ])(
    "sends $account's credential, keeping the request's own headers",
    async ({ signIn, name, value, credential }) => {
      signIn()
      const reported: AuthCredential[] = []
      const schemes: AuthScheme[] = []

      const init = await withAgentAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        onAuthScheme: (scheme) => schemes.push(scheme),
        onAuthCredential: (kind) => reported.push(kind)
      })
      init.onAuthScheme?.('none')
      init.onAuthCredential?.('none')

      const headers = new Headers(init.headers)
      expect(headers.get(name)).toBe(value)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(init.method).toBe('POST')
      expect(init.redirect).toBe('error')
      expect(reported).toEqual([credential])
      expect(schemes).toEqual(['cloud-auth-header'])
    }
  )

  it.for(missingWorkspaceTokens)(
    'fails closed for a signed-in session with $label',
    async ({ token, apiKey }) => {
      signInWithout(token, apiKey)

      await expect(withAgentAuth({ method: 'POST' })).rejects.toThrow(
        token ?? AuthStoreError
      )
    }
  )

  it('sends nothing for a signed-out user whose last workspace is still selected', async () => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-team' })
    workspaceToken(undefined)

    const headers = new Headers(
      (await withAgentAuth({ method: 'POST' })).headers
    )

    expect(headers.has('Authorization')).toBe(false)
  })

  it('leaves a cloud request to fetchApi, never attaching the personal token', async () => {
    distribution.isCloud = true
    signInPersonal()
    workspaceToken('workspace-token')

    const init = await withAgentAuth({ method: 'GET' })

    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(init.redirect).toBeUndefined()
  })

  it('sends nothing and leaves the redirect policy alone for a signed-out user', async () => {
    workspaceToken(undefined)

    const init = await withAgentAuth({ method: 'GET' })

    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(new Headers(init.headers).has('X-API-KEY')).toBe(false)
    expect(init.redirect).toBeUndefined()
  })
})

describe('agentSocketAuthParams', () => {
  it.for<{ label: string; signIn: () => void; token: string }>([
    {
      label: 'the workspace token',
      signIn: () => {
        signInPersonal()
        workspaceToken('workspace-token')
      },
      token: 'workspace-token'
    },
    {
      label: 'an API key',
      signIn: () => storedApiKey('comfyui-key'),
      token: 'comfyui-key'
    }
  ])('passes $label as the token off-cloud', async ({ signIn, token }) => {
    signIn()

    expect((await agentSocketAuthParams())?.get('token')).toBe(token)
  })

  it.for(missingWorkspaceTokens)(
    'fails closed for a signed-in session with $label',
    async ({ token, apiKey }) => {
      signInWithout(token, apiKey)

      await expect(agentSocketAuthParams()).rejects.toThrow(
        token ?? AuthStoreError
      )
    }
  )

  it('connects without a token when signed out', async () => {
    workspaceToken(undefined)

    expect((await agentSocketAuthParams())?.has('token')).toBe(false)
  })

  it.for([
    {
      label: 'its auth params',
      params: new URLSearchParams({ workspace_id: 'ws-1' })
    },
    { label: 'that no one can open it', params: null }
  ])(
    'takes the cloud socket auth from the /ws auth seam, reporting $label',
    async ({ params }) => {
      distribution.isCloud = true
      userHeader({ Authorization: 'Bearer personal-id-token' })
      vi.mocked(api.socketAuthParams).mockResolvedValue(params)

      await expect(agentSocketAuthParams()).resolves.toBe(params)
    }
  )
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
