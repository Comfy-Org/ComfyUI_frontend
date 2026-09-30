import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'

import { useLocalOAuthStore } from './localOAuthStore'
import { LOCAL_OAUTH_MESSAGE_TYPE } from './pkce'

const STORAGE_KEY = 'Comfy.LocalOAuth.Session'

class FakeChannel {
  static open = new Set<FakeChannel>()
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  constructor(readonly name: string) {
    FakeChannel.open.add(this)
  }
  close() {
    FakeChannel.open.delete(this)
  }
  static deliver(data: unknown) {
    for (const channel of FakeChannel.open) {
      channel.onmessage?.(new MessageEvent('message', { data }))
    }
  }
}

function jwt(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '')
  return `${encode({ alg: 'ES256' })}.${encode(claims)}.sig`
}

function tokenResponse(accessToken: string, refreshToken: string) {
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
      scope: 'comfy-cloud:user:read',
      token_type: 'Bearer'
    }),
    { status: 200 }
  )
}

function storeSession(overrides: Record<string, unknown> = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: Date.now() + 10 * 60_000,
      cloudBaseUrl: 'https://cloud.example',
      userId: 'user-1',
      ...overrides
    })
  )
}

function formBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const init = fetchMock.mock.calls[call][1] as RequestInit
  return Object.fromEntries(new URLSearchParams(String(init.body)))
}

describe('useLocalOAuthStore', () => {
  const fetchMock = vi.fn()
  const popup = { location: { href: '' } }

  beforeEach(() => {
    localStorage.clear()
    FakeChannel.open.clear()
    popup.location.href = ''
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  })

  async function startSignIn() {
    const store = useLocalOAuthStore()
    const result = store.signIn()
    await vi.waitFor(() => expect(popup.location.href).not.toBe(''))
    const state = new URL(popup.location.href).searchParams.get('state')
    return { store, result, state }
  }

  describe('signIn', () => {
    it('refuses a callback with a forged state without redeeming it', async () => {
      const { store, result } = await startSignIn()

      FakeChannel.deliver({
        type: LOCAL_OAUTH_MESSAGE_TYPE,
        state: 'forged',
        code: 'attacker-code'
      })

      await expect(result).resolves.toBe('failed')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(false)
    })

    it('redeems the code with the verifier and stores the session', async () => {
      fetchMock.mockResolvedValue(
        tokenResponse(jwt({ sub: 'user-9', email: 'sso@corp.example' }), 'r1')
      )
      const { store, result, state } = await startSignIn()
      const authorize = new URL(popup.location.href)

      FakeChannel.deliver({ type: LOCAL_OAUTH_MESSAGE_TYPE, state, code: 'c1' })

      await expect(result).resolves.toBe('signed_in')
      expect(fetchMock.mock.calls[0][0]).toBe(
        `${getComfyCloudBaseUrl()}/oauth/token`
      )
      const body = formBody(fetchMock)
      expect(body).toMatchObject({
        grant_type: 'authorization_code',
        client_id: 'comfyui-local',
        code: 'c1',
        redirect_uri: authorize.searchParams.get('redirect_uri')
      })
      expect(body.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(store.isAuthenticated).toBe(true)
      expect(store.userId).toBe('user-9')
      expect(store.email).toBe('sso@corp.example')
    })

    it('reports a blocked popup', async () => {
      vi.mocked(window.open).mockReturnValue(null)
      await expect(useLocalOAuthStore().signIn()).resolves.toBe('popup_blocked')
    })
  })

  describe('getAccessToken', () => {
    it('returns a fresh token without calling the server', async () => {
      storeSession()
      await expect(useLocalOAuthStore().getAccessToken()).resolves.toBe(
        'old-access'
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rotates the refresh token before expiry', async () => {
      storeSession({ expiresAt: Date.now() + 30_000 })
      fetchMock.mockResolvedValue(
        tokenResponse(jwt({ sub: 'user-1' }), 'new-refresh')
      )
      const store = useLocalOAuthStore()

      const token = await store.getAccessToken()

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://cloud.example/oauth/token'
      )
      expect(formBody(fetchMock)).toEqual({
        client_id: 'comfyui-local',
        grant_type: 'refresh_token',
        refresh_token: 'old-refresh'
      })
      expect(token).not.toBe('old-access')
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).refreshToken).toBe(
        'new-refresh'
      )
    })

    it('shares one refresh between concurrent callers', async () => {
      storeSession({ expiresAt: Date.now() - 1 })
      fetchMock.mockResolvedValue(tokenResponse(jwt({ sub: 'user-1' }), 'r2'))
      const store = useLocalOAuthStore()

      await Promise.all([store.getAccessToken(), store.getAccessToken()])

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('signs out when the grant is revoked', async () => {
      storeSession({ expiresAt: Date.now() - 1 })
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400
        })
      )
      const store = useLocalOAuthStore()

      await expect(store.getAccessToken()).resolves.toBeUndefined()
      expect(store.isAuthenticated).toBe(false)
    })

    it('keeps the session when offline so a later refresh can recover', async () => {
      storeSession({ expiresAt: Date.now() - 1 })
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const store = useLocalOAuthStore()

      await expect(store.getAccessToken()).resolves.toBeUndefined()
      expect(store.isAuthenticated).toBe(true)
    })
  })

  it('signOut clears the stored session', async () => {
    storeSession()
    const store = useLocalOAuthStore()

    store.signOut()

    expect(store.isAuthenticated).toBe(false)
    await expect(store.getAccessToken()).resolves.toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
