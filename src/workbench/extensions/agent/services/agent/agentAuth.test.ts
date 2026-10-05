vi.mock(import('firebase/auth'))
vi.mock(import('@/services/dialogService'))
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'

import { agentSocketToken, ensureSignedIn, withAgentAuth } from './agentAuth'

function userHeader(header: AuthHeader | null): void {
  vi.spyOn(useAuthStore(), 'getUserAuthHeader').mockResolvedValue(header)
}

describe('withAgentAuth', () => {
  it.for([
    {
      account: 'a signed-in session',
      header: { Authorization: 'Bearer id-token' },
      name: 'Authorization',
      value: 'Bearer id-token'
    },
    {
      account: 'an API-key session',
      header: { 'X-API-KEY': 'comfyui-key' },
      name: 'X-API-KEY',
      value: 'comfyui-key'
    }
  ])(
    "sends $account's user auth header, keeping the request's own",
    async ({ header, name, value }) => {
      userHeader(header as AuthHeader)

      const init = await withAgentAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const headers = new Headers(init.headers)
      expect(headers.get(name)).toBe(value)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(init.method).toBe('POST')
    }
  )

  it('sends nothing for a signed-out user', async () => {
    userHeader(null)

    const init = await withAgentAuth({ method: 'GET' })

    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(new Headers(init.headers).has('X-API-KEY')).toBe(false)
  })

  // The session's own header is used even when an API key is stored: a key
  // standing in for a failed token refresh could belong to another account.
  it('asks the store for the user-identity header, not the workspace one', async () => {
    const authStore = useAuthStore()
    const user = vi
      .spyOn(authStore, 'getUserAuthHeader')
      .mockResolvedValue({ Authorization: 'Bearer id-token' })
    const workspace = vi.spyOn(authStore, 'getAuthHeader')

    await withAgentAuth({ method: 'GET' })

    expect(user).toHaveBeenCalledOnce()
    expect(workspace).not.toHaveBeenCalled()
  })

  it('refuses redirects on a request carrying the header', async () => {
    userHeader({ 'X-API-KEY': 'comfyui-key' })

    const init = await withAgentAuth({ method: 'GET' })

    expect(init.redirect).toBe('error')
  })

  it('leaves the redirect policy alone when no header is attached', async () => {
    userHeader(null)

    const init = await withAgentAuth({ method: 'GET' })

    expect(init.redirect).toBeUndefined()
  })
})

describe('agentSocketToken', () => {
  // The socket carries what api.fetchApi sends, so it lands in the same
  // workspace as every other request.
  it.for([
    {
      label: 'a bearer token',
      header: { Authorization: 'Bearer workspace-jwt' } as AuthHeader,
      token: 'workspace-jwt'
    },
    {
      label: 'an API key',
      header: { 'X-API-KEY': 'comfyui-key' } as AuthHeader,
      token: 'comfyui-key'
    }
  ])('passes $label as the socket token', async ({ header, token }) => {
    vi.spyOn(useAuthStore(), 'getAuthHeader').mockResolvedValue(header)

    expect(await agentSocketToken()).toBe(token)
  })

  it('connects without a token when signed out', async () => {
    vi.spyOn(useAuthStore(), 'getAuthHeader').mockResolvedValue(null)

    expect(await agentSocketToken()).toBeUndefined()
  })
})

describe('ensureSignedIn', () => {
  beforeEach(() => {
    vi.mocked(useDialogService().showSignInDialog).mockReset()
  })

  it('lets a signed-in user send without asking', async () => {
    userHeader({ Authorization: 'Bearer id-token' })

    await expect(ensureSignedIn()).resolves.toBe(true)
    expect(useDialogService().showSignInDialog).not.toHaveBeenCalled()
  })

  it('asks a signed-out user to sign in and holds the turn if they decline', async () => {
    userHeader(null)
    vi.mocked(useDialogService().showSignInDialog).mockResolvedValue(false)

    await expect(ensureSignedIn()).resolves.toBe(false)
    expect(useDialogService().showSignInDialog).toHaveBeenCalledOnce()
  })

  it('sends once the sign-in dialog produced a session', async () => {
    const spy = vi
      .spyOn(useAuthStore(), 'getUserAuthHeader')
      .mockResolvedValue(null)
    vi.mocked(useDialogService().showSignInDialog).mockImplementation(
      async () => {
        spy.mockResolvedValue({ Authorization: 'Bearer fresh-token' })
        return true
      }
    )

    await expect(ensureSignedIn()).resolves.toBe(true)
  })

  it('holds the turn when the sign-in dialog fails to open', async () => {
    userHeader(null)
    vi.mocked(useDialogService().showSignInDialog).mockRejectedValue(
      new Error('chunk failed')
    )

    await expect(ensureSignedIn()).resolves.toBe(false)
  })

  it('sends without asking in development, where the dev proxy can inject a credential', async () => {
    vi.stubEnv('MODE', 'development')
    userHeader(null)

    await expect(ensureSignedIn()).resolves.toBe(true)
    expect(useDialogService().showSignInDialog).not.toHaveBeenCalled()
  })
})
