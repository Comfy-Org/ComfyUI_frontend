import { codeChallengeS256 } from '@comfyorg/account-core/oauthPkce'
import { describe, expect, it, vi } from 'vitest'

import type { DesktopHostAuthState } from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import type { LocalWebAuthEnvironment } from '@/platform/auth/localWeb/localWebAuthBridge'
import { createLocalWebAuthBridge } from '@/platform/auth/localWeb/localWebAuthBridge'
import { createMemoryTokenStore } from '@/platform/auth/localWeb/localWebTokenStore'

const ISSUER = 'https://cloud.example.test'
const NOW = 1_700_000_000_000
const PENDING_KEY = 'Comfy.LocalWebSignIn.Pending'

function base64Url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function accessToken(claims: Record<string, unknown>): string {
  return `${base64Url({ alg: 'ES256' })}.${base64Url(claims)}.signature`
}

const WS1_TOKEN = accessToken({
  sub: 'user-1',
  email: 'a@example.com',
  workspace_id: 'ws-1'
})

function tokenResponse(access: string, refresh: string, expiresIn = 3600) {
  return new Response(
    JSON.stringify({
      access_token: access,
      expires_in: expiresIn,
      refresh_token: refresh,
      scope: 'comfy-cloud:user:read',
      token_type: 'Bearer'
    }),
    { status: 200 }
  )
}

function oauthError(error: string) {
  return new Response(JSON.stringify({ error }), { status: 400 })
}

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key)
  }
}

function setup(pageUrl = 'http://127.0.0.1:8188/?workflow=a') {
  const page = { url: pageUrl }
  const storage = memoryStorage()
  const tokens = createMemoryTokenStore()
  const clock = { now: NOW }
  const env = {
    issuer: ISSUER,
    pageUrl: () => page.url,
    navigate: vi.fn<(url: string) => void>(),
    replaceUrl: vi.fn((url: string) => {
      page.url = url
    }),
    sessionStorage: storage,
    tokens,
    fetchImpl: vi.fn<typeof fetch>(async () =>
      tokenResponse(WS1_TOKEN, 'refresh-1')
    ),
    now: () => clock.now
  } satisfies LocalWebAuthEnvironment
  const bridge = createLocalWebAuthBridge(env)
  const states: DesktopHostAuthState[] = []
  bridge.onChanged((state) => states.push(state))
  return { bridge, env, page, storage, tokens, clock, states }
}

function formOf(init: RequestInit | undefined): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(String(init?.body)))
}

async function signedIn(expiresIn = 3600) {
  const harness = setup('http://127.0.0.1:8188/?code=code-1&state=state-1')
  harness.storage.setItem(
    PENDING_KEY,
    JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
  )
  harness.env.fetchImpl.mockResolvedValueOnce(
    tokenResponse(WS1_TOKEN, 'refresh-1', expiresIn)
  )
  await harness.bridge.completeSignIn()
  harness.env.fetchImpl.mockClear()
  harness.states.length = 0
  return harness
}

describe('requestSignIn', () => {
  it('keeps the verifier for the redirect and navigates to authorize with its challenge', async () => {
    const { bridge, env, storage } = setup()

    void bridge.requestSignIn()
    await vi.waitFor(() => expect(env.navigate).toHaveBeenCalledOnce())

    const pending = JSON.parse(storage.getItem(PENDING_KEY) ?? '')
    const url = new URL(env.navigate.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe(`${ISSUER}/oauth/authorize`)
    expect(url.searchParams.get('client_id')).toBe('comfy-local-web')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:8188/')
    expect(url.searchParams.get('state')).toBe(pending.state)
    expect(url.searchParams.get('code_challenge')).toBe(
      await codeChallengeS256(pending.verifier)
    )
  })

  it('stays signed out without navigating when the verifier cannot be kept', async () => {
    const { bridge, env } = setup()
    env.sessionStorage.setItem = () => {
      throw new DOMException('blocked', 'SecurityError')
    }

    await expect(bridge.requestSignIn()).resolves.toEqual({
      status: 'signed_out'
    })
    expect(env.navigate).not.toHaveBeenCalled()
  })
})

describe('completeSignIn', () => {
  it('exchanges the code, strips the redirect params, and signs in', async () => {
    const { bridge, env, page, storage, states } = setup(
      'http://127.0.0.1:8188/?workflow=a&code=code-1&state=state-1&iss=x'
    )
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
    )

    await expect(bridge.completeSignIn()).resolves.toEqual({
      kind: 'signed_in'
    })

    expect(page.url).toBe('http://127.0.0.1:8188/?workflow=a')
    expect(formOf(env.fetchImpl.mock.calls[0][1])).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      code_verifier: 'verifier-1',
      redirect_uri: 'http://127.0.0.1:8188/',
      client_id: 'comfy-local-web'
    })
    const expected = {
      status: 'signed_in',
      userId: 'user-1',
      email: 'a@example.com',
      workspaceId: 'ws-1'
    }
    expect(states).toEqual([expected])
    await expect(bridge.getState()).resolves.toEqual(expected)
    expect(storage.items.size).toBe(0)
  })

  it('leaves a page without a redirect untouched', async () => {
    const { bridge, env } = setup()

    await expect(bridge.completeSignIn()).resolves.toEqual({ kind: 'none' })
    expect(env.replaceUrl).not.toHaveBeenCalled()
    expect(env.fetchImpl).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'a state this tab did not send',
      query: 'code=code-1&state=forged',
      pending: { verifier: 'verifier-1', state: 'state-1' },
      respond: null,
      expected: { kind: 'failed', reason: 'state-mismatch' }
    },
    {
      name: 'a code with no pending sign-in',
      query: 'code=code-1&state=state-1',
      pending: null,
      respond: null,
      expected: { kind: 'failed', reason: 'state-mismatch' }
    },
    {
      name: 'a denied consent',
      query: 'error=access_denied&state=state-1',
      pending: { verifier: 'verifier-1', state: 'state-1' },
      respond: null,
      expected: { kind: 'failed', reason: 'denied', error: 'access_denied' }
    },
    {
      name: 'a rejected code',
      query: 'code=code-1&state=state-1',
      pending: { verifier: 'verifier-1', state: 'state-1' },
      respond: () => oauthError('invalid_grant'),
      expected: {
        kind: 'failed',
        reason: 'invalid_grant',
        error: 'invalid_grant'
      }
    },
    {
      name: 'an unreachable token endpoint',
      query: 'code=code-1&state=state-1',
      pending: { verifier: 'verifier-1', state: 'state-1' },
      respond: () => new Response('', { status: 502 }),
      expected: { kind: 'failed', reason: 'unavailable' }
    },
    {
      name: 'an access token with no account',
      query: 'code=code-1&state=state-1',
      pending: { verifier: 'verifier-1', state: 'state-1' },
      respond: () => tokenResponse('not-a-jwt', 'refresh-1'),
      expected: { kind: 'failed', reason: 'invalid-token' }
    }
  ])(
    'stays signed out after $name',
    async ({ query, pending, respond, expected }) => {
      const { bridge, env, page, storage, states } = setup(
        `http://127.0.0.1:8188/?${query}`
      )
      if (pending) storage.setItem(PENDING_KEY, JSON.stringify(pending))
      if (respond) env.fetchImpl.mockImplementationOnce(async () => respond())

      await expect(bridge.completeSignIn()).resolves.toEqual(expected)

      expect(page.url).toBe('http://127.0.0.1:8188/')
      expect(states).toEqual([])
      await expect(bridge.getState()).resolves.toEqual({
        status: 'signed_out'
      })
    }
  )

  it('never exchanges a code whose state did not match', async () => {
    const { bridge, env, storage } = setup(
      'http://127.0.0.1:8188/?code=code-1&state=forged'
    )
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
    )

    await bridge.completeSignIn()

    expect(env.fetchImpl).not.toHaveBeenCalled()
  })
})

describe('getWorkspaceToken', () => {
  it.for([
    { workspaceId: 'ws-1', expected: WS1_TOKEN },
    { workspaceId: 'ws-2', expected: null }
  ])(
    'releases the access token only for its own workspace ($workspaceId)',
    async ({ workspaceId, expected }) => {
      const { bridge } = await signedIn()

      await expect(bridge.getWorkspaceToken(workspaceId)).resolves.toBe(
        expected
      )
    }
  )

  it('has nothing to release while signed out', async () => {
    const { bridge, env } = setup()

    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()
    expect(env.fetchImpl).not.toHaveBeenCalled()
  })

  it('refreshes once for concurrent reads of an expiring token, keeping the rotated refresh token', async () => {
    const { bridge, env } = await signedIn(30)
    const renewed = accessToken({ sub: 'user-1', workspace_id: 'ws-1', n: 2 })
    env.fetchImpl.mockImplementation(async () =>
      tokenResponse(renewed, 'refresh-2')
    )

    const tokens = await Promise.all([
      bridge.getWorkspaceToken('ws-1'),
      bridge.getWorkspaceToken('ws-1')
    ])

    expect(tokens).toEqual([renewed, renewed])
    expect(env.fetchImpl).toHaveBeenCalledOnce()
    expect(formOf(env.fetchImpl.mock.calls[0][1])).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1'
    })
  })

  it('signs out when the refresh token is dead', async () => {
    const { bridge, env, states } = await signedIn(30)
    env.fetchImpl.mockImplementation(async () => oauthError('invalid_grant'))

    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()

    expect(states).toEqual([{ status: 'signed_out' }])
  })

  it('stays signed in and retries later when the token endpoint is unreachable', async () => {
    const { bridge, env, states } = await signedIn(30)
    env.fetchImpl.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()
    expect(states).toEqual([])

    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBe(WS1_TOKEN)
  })
})

describe('signOut', () => {
  it('drops the tokens and tells listeners', async () => {
    const { bridge, states } = await signedIn()

    await expect(bridge.signOut()).resolves.toEqual({ status: 'signed_out' })

    expect(states).toEqual([{ status: 'signed_out' }])
    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()
  })

  it('discards a refresh that finishes after sign-out', async () => {
    const { bridge, env, tokens } = await signedIn(30)
    let answer: (response: Response) => void = () => {}
    env.fetchImpl.mockImplementation(
      () => new Promise((resolve) => (answer = resolve))
    )

    const read = bridge.getWorkspaceToken('ws-1')
    await bridge.signOut()
    answer(tokenResponse(WS1_TOKEN, 'refresh-2'))

    await expect(read).resolves.toBeNull()
    expect(tokens.read()).toBeUndefined()
  })
})
