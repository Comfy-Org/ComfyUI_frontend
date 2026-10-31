import { codeChallengeS256 } from '@comfyorg/account-core/oauthPkce'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopHostAuthState } from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import type {
  FailedSignIn,
  LocalWebAuthBridge,
  LocalWebAuthEnvironment,
  LocalWebMessage,
  LocalWebPopup
} from '@/platform/auth/localWeb/localWebAuthBridge'
import { createLocalWebAuthBridge } from '@/platform/auth/localWeb/localWebAuthBridge'
import type { LocalWebTokenStore } from '@/platform/auth/localWeb/localWebTokenStore'
import {
  LOCAL_WEB_TOKENS_KEY,
  createMemoryTokenStore,
  createStorageTokenStore
} from '@/platform/auth/localWeb/localWebTokenStore'

const ISSUER = 'https://cloud.example.test'
const NOW = 1_700_000_000_000
const PENDING_KEY = 'Comfy.LocalWebSignIn.Pending'
const TAB_WORKSPACE_KEY = 'Comfy.LocalWebSignIn.TabWorkspace'

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

function setup(
  pageUrl = 'http://127.0.0.1:8188/?workflow=a',
  {
    tokens = createMemoryTokenStore(),
    withRefreshLock = <T>(task: () => Promise<T>) => task()
  }: {
    tokens?: LocalWebTokenStore
    withRefreshLock?: LocalWebAuthEnvironment['withRefreshLock']
  } = {}
) {
  const page = { url: pageUrl }
  const storage = memoryStorage()
  const clock = { now: NOW }
  const popup = {
    closed: false,
    close() {
      popup.closed = true
    },
    location: { href: 'about:blank' }
  }
  const messages = new Set<(message: LocalWebMessage) => void>()
  const post = (message: LocalWebMessage) =>
    messages.forEach((listener) => listener(message))
  const env = {
    issuer: ISSUER,
    pageUrl: () => page.url,
    openPopup: vi.fn<() => LocalWebPopup | null>(() => popup),
    onMessage(listener: (message: LocalWebMessage) => void) {
      messages.add(listener)
      return () => messages.delete(listener)
    },
    reportSignInFailure: vi.fn<(failure: FailedSignIn) => void>(),
    replaceUrl: vi.fn((url: string) => {
      page.url = url
    }),
    sessionStorage: storage,
    tokens,
    withRefreshLock,
    fetchImpl: vi.fn<typeof fetch>(async () =>
      tokenResponse(WS1_TOKEN, 'refresh-1')
    ),
    now: () => clock.now
  } satisfies LocalWebAuthEnvironment
  const bridge = createLocalWebAuthBridge(env)
  const states: DesktopHostAuthState[] = []
  bridge.onChanged((state) => states.push(state))
  return { bridge, env, page, storage, tokens, clock, states, popup, post }
}

type PopupEnv = Pick<ReturnType<typeof setup>['env'], 'openPopup'>

function authorizeUrlOf(env: PopupEnv): string | undefined {
  const opened = env.openPopup.mock.results.at(0)
  const href =
    opened?.type === 'return' ? opened.value?.location.href : undefined
  return href && href !== 'about:blank' ? href : undefined
}

function authorizeRequest(env: PopupEnv) {
  return new URL(authorizeUrlOf(env) ?? '')
}

async function authorized(env: PopupEnv): Promise<void> {
  await vi.waitFor(() => expect(authorizeUrlOf(env)).toBeDefined())
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

const CALLBACK_URI = `${ISSUER}/oauth/local-callback.html`

describe('requestSignIn', () => {
  it('opens authorize in a popup with its challenge, the Cloud callback and this page in the state', async () => {
    const { bridge, env, storage } = setup()

    void bridge.requestSignIn()
    await authorized(env)

    const pending = JSON.parse(storage.getItem(PENDING_KEY) ?? '')
    const url = authorizeRequest(env)
    expect(url.origin + url.pathname).toBe(`${ISSUER}/oauth/authorize`)
    expect(url.searchParams.get('client_id')).toBe('comfy-local-web')
    expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK_URI)
    expect(url.searchParams.get('state')).toBe(pending.state)
    expect(pending.state).toMatch(/~http%3A%2F%2F127\.0\.0\.1%3A8188$/)
    expect(url.searchParams.get('code_challenge')).toBe(
      await codeChallengeS256(pending.verifier)
    )
  })

  it('signs in with the code the Cloud callback posts back', async () => {
    const { bridge, env, storage, popup, post } = setup()
    const signingIn = bridge.requestSignIn()
    await authorized(env)
    const { state } = JSON.parse(storage.getItem(PENDING_KEY) ?? '')

    post({
      origin: ISSUER,
      source: popup,
      data: {
        type: 'comfy-local-web-sign-in',
        search: `?code=code-1&state=${encodeURIComponent(state)}`
      }
    })

    await expect(signingIn).resolves.toMatchObject({
      status: 'signed_in',
      workspaceId: 'ws-1'
    })
    expect(formOf(env.fetchImpl.mock.calls[0][1])).toMatchObject({
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: CALLBACK_URI
    })
  })

  it('lets two tabs sign in at once, each finishing only from its own popup', async () => {
    const tokens = createMemoryTokenStore()
    const first = setup(undefined, { tokens })
    const second = setup(undefined, { tokens })
    const callbackFrom = (tab: ReturnType<typeof setup>, code: string) => {
      const { state } = JSON.parse(tab.storage.getItem(PENDING_KEY) ?? '')
      return {
        origin: ISSUER,
        source: tab.popup,
        data: {
          type: 'comfy-local-web-sign-in',
          search: `?code=${code}&state=${encodeURIComponent(state)}`
        }
      }
    }
    const firstSigningIn = first.bridge.requestSignIn()
    const secondSigningIn = second.bridge.requestSignIn()
    await authorized(first.env)
    await authorized(second.env)

    const secondCallback = callbackFrom(second, 'code-2')
    first.post(secondCallback)
    second.post(secondCallback)
    const firstCallback = callbackFrom(first, 'code-1')
    second.post(firstCallback)
    first.post(firstCallback)

    await expect(firstSigningIn).resolves.toMatchObject({
      status: 'signed_in'
    })
    await expect(secondSigningIn).resolves.toMatchObject({
      status: 'signed_in'
    })
    expect(first.env.fetchImpl).toHaveBeenCalledOnce()
    expect(formOf(first.env.fetchImpl.mock.calls[0][1]).code).toBe('code-1')
    expect(second.env.fetchImpl).toHaveBeenCalledOnce()
    expect(formOf(second.env.fetchImpl.mock.calls[0][1]).code).toBe('code-2')
    expect(first.env.reportSignInFailure).not.toHaveBeenCalled()
    expect(second.env.reportSignInFailure).not.toHaveBeenCalled()
  })

  it('opens the popup within the click, before preparing the sign-in', () => {
    const { bridge, env, popup } = setup()

    void bridge.requestSignIn()

    expect(env.openPopup).toHaveBeenCalledOnce()
    expect(popup.location.href).toBe('about:blank')
  })

  it('opens the popup within the click when switching to a workspace this page never signed in to', async () => {
    const { bridge, env } = await signedIn()

    void bridge.switchWorkspace?.('ws-2')

    expect(env.openPopup).toHaveBeenCalledOnce()
    await authorized(env)
  })

  it('closes the blank popup when the sign-in cannot be prepared', async () => {
    const { bridge, env, storage, popup } = setup()
    storage.setItem = () => {
      throw new DOMException('full')
    }

    await bridge.requestSignIn()

    expect(popup.closed).toBe(true)
    expect(popup.location.href).toBe('about:blank')
    expect(env.reportSignInFailure).toHaveBeenCalledWith({
      kind: 'failed',
      reason: 'storage-unavailable'
    })
  })

  it('shares one popup and one code exchange between concurrent sign-ins', async () => {
    const { bridge, env, storage, popup, post, tokens } = setup()
    tokens.write({
      accessToken: WS1_TOKEN,
      refreshToken: 'refresh-1',
      expiresAt: NOW + 3_600_000,
      scope: 'comfy-cloud:user:read'
    })
    const fromButton = bridge.requestSignIn()
    const fromSwitch = bridge.switchWorkspace?.('ws-2')
    await authorized(env)
    const { state } = JSON.parse(storage.getItem(PENDING_KEY) ?? '')

    post({
      origin: ISSUER,
      source: popup,
      data: {
        type: 'comfy-local-web-sign-in',
        search: `?code=code-1&state=${encodeURIComponent(state)}`
      }
    })

    const [buttonState, switchState] = await Promise.all([
      fromButton,
      fromSwitch
    ])
    expect(buttonState).toEqual(switchState)
    expect(env.openPopup).toHaveBeenCalledOnce()
    expect(env.fetchImpl).toHaveBeenCalledOnce()
    expect(env.reportSignInFailure).not.toHaveBeenCalled()
  })

  it.for([
    { case: 'another origin', origin: 'https://evil.example.test', own: true },
    { case: 'another window', origin: ISSUER, own: false }
  ])('ignores a callback message from $case', async ({ origin, own }) => {
    vi.useFakeTimers()
    const { bridge, env, storage, popup, post } = setup()
    const signingIn = bridge.requestSignIn()
    await authorized(env)
    const { state } = JSON.parse(storage.getItem(PENDING_KEY) ?? '')

    post({
      origin,
      source: own ? popup : {},
      data: {
        type: 'comfy-local-web-sign-in',
        search: `?code=x&state=${state}`
      }
    })
    popup.closed = true
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(signingIn).resolves.toEqual({ status: 'signed_out' })
    expect(env.fetchImpl).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('stays signed out without a message when the person closes the popup', async () => {
    vi.useFakeTimers()
    const { bridge, env, popup } = setup()
    const signingIn = bridge.requestSignIn()
    await authorized(env)

    popup.closed = true
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(signingIn).resolves.toEqual({ status: 'signed_out' })
    expect(env.reportSignInFailure).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('says so when the browser blocks the popup', async () => {
    const { bridge, env } = setup()
    env.openPopup.mockReturnValueOnce(null)

    await expect(bridge.requestSignIn()).resolves.toEqual({
      status: 'signed_out'
    })
    expect(env.reportSignInFailure).toHaveBeenCalledWith({
      kind: 'failed',
      reason: 'popup-blocked'
    })
  })

  it('reports a code the token endpoint refuses', async () => {
    const { bridge, env, storage, popup, post } = setup()
    env.fetchImpl.mockResolvedValueOnce(oauthError('invalid_grant'))
    const signingIn = bridge.requestSignIn()
    await authorized(env)
    const { state } = JSON.parse(storage.getItem(PENDING_KEY) ?? '')

    post({
      origin: ISSUER,
      source: popup,
      data: {
        type: 'comfy-local-web-sign-in',
        search: `?code=code-1&state=${encodeURIComponent(state)}`
      }
    })

    await expect(signingIn).resolves.toEqual({ status: 'signed_out' })
    expect(env.reportSignInFailure).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'failed' })
    )
  })

  it('stays signed out without opening anything when the verifier cannot be kept', async () => {
    const { bridge, env } = setup()
    env.sessionStorage.setItem = () => {
      throw new DOMException('blocked', 'SecurityError')
    }

    await expect(bridge.requestSignIn()).resolves.toEqual({
      status: 'signed_out'
    })
    expect(authorizeUrlOf(env)).toBeUndefined()
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
    expect(storage.items.has(PENDING_KEY)).toBe(false)
  })

  it('leaves a page without a redirect untouched, keeping the pending sign-in for the callback', async () => {
    const { bridge, env, page, storage } = setup()
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
    )

    await expect(bridge.completeSignIn()).resolves.toEqual({ kind: 'none' })
    expect(env.replaceUrl).not.toHaveBeenCalled()
    expect(env.fetchImpl).not.toHaveBeenCalled()

    page.url = 'http://127.0.0.1:8188/?code=code-1&state=state-1'
    await expect(bridge.completeSignIn()).resolves.toEqual({
      kind: 'signed_in'
    })
    expect(formOf(env.fetchImpl.mock.calls[0][1])).toMatchObject({
      code: 'code-1',
      code_verifier: 'verifier-1'
    })
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

  it('reports a sign-in it could not persist and stays signed out', async () => {
    const tokens = { ...createMemoryTokenStore(), write: () => false }
    const { bridge, storage, states } = setup(
      'http://127.0.0.1:8188/?code=code-1&state=state-1',
      { tokens }
    )
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
    )

    await expect(bridge.completeSignIn()).resolves.toEqual({
      kind: 'failed',
      reason: 'storage-unavailable'
    })
    expect(states).toEqual([])
    await expect(bridge.getState()).resolves.toEqual({ status: 'signed_out' })
  })

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

  it('stays signed in while the token endpoint is unreachable, and says so again once it answers', async () => {
    const { bridge, env, states } = await signedIn(30)
    const renewed = accessToken({ sub: 'user-1', workspace_id: 'ws-1', n: 2 })
    env.fetchImpl.mockImplementation(
      async () => new Response(null, { status: 503 })
    )

    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()
    expect(states).toEqual([])

    env.fetchImpl.mockImplementation(async () =>
      tokenResponse(renewed, 'refresh-2')
    )
    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBe(renewed)

    expect(states.at(-1)).toMatchObject({
      status: 'signed_in',
      userId: 'user-1',
      workspaceId: 'ws-1'
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

  describe('after a token read finds the endpoint unreachable', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('says it is signed in again once the endpoint answers, with no other token read', async () => {
      const { bridge, env, states } = await signedIn(30)
      const renewed = accessToken({ sub: 'user-1', workspace_id: 'ws-1', n: 2 })
      env.fetchImpl.mockImplementation(
        async () => new Response(null, { status: 503 })
      )
      await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()

      env.fetchImpl.mockImplementation(async () =>
        tokenResponse(renewed, 'refresh-2')
      )
      await vi.advanceTimersByTimeAsync(5_000)

      expect(states.at(-1)).toMatchObject({
        status: 'signed_in',
        userId: 'user-1',
        workspaceId: 'ws-1'
      })
    })

    it('retries eight times after the failed read while the endpoint stays down, then stops', async () => {
      const { bridge, env } = await signedIn(30)
      const signInRequests = env.fetchImpl.mock.calls.length
      env.fetchImpl.mockImplementation(
        async () => new Response(null, { status: 503 })
      )
      await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()

      await vi.advanceTimersByTimeAsync(60 * 60_000)

      expect(env.fetchImpl.mock.calls.length - signInRequests).toBe(1 + 8)
    })

    it('starts a full retry round for a new outage after a token read recovered from the last one', async () => {
      const { bridge, env } = await signedIn(30)
      const signInRequests = env.fetchImpl.mock.calls.length
      const renewed = accessToken({ sub: 'user-1', workspace_id: 'ws-1', n: 2 })
      env.fetchImpl.mockImplementation(
        async () => new Response(null, { status: 503 })
      )
      await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()
      await vi.advanceTimersByTimeAsync(15_000)

      env.fetchImpl.mockImplementation(async () =>
        tokenResponse(renewed, 'refresh-2', 30)
      )
      await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBe(renewed)

      env.fetchImpl.mockImplementation(
        async () => new Response(null, { status: 503 })
      )
      await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()
      await vi.advanceTimersByTimeAsync(60 * 60_000)

      expect(env.fetchImpl.mock.calls.length - signInRequests).toBe(
        1 + 2 + 1 + 1 + 8
      )
    })

    it('stops retrying once the refresh token turns out to be dead', async () => {
      const { bridge, env, states } = await signedIn(30)
      env.fetchImpl.mockImplementation(
        async () => new Response(null, { status: 503 })
      )
      await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()

      env.fetchImpl.mockImplementation(async () => oauthError('invalid_grant'))
      await vi.advanceTimersByTimeAsync(5_000)
      const attempts = env.fetchImpl.mock.calls.length
      await vi.advanceTimersByTimeAsync(60 * 60_000)

      expect(states).toEqual([{ status: 'signed_out' }])
      expect(env.fetchImpl.mock.calls.length).toBe(attempts)
    })
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

const WS2_TOKEN = accessToken({
  sub: 'user-1',
  email: 'a@example.com',
  workspace_id: 'ws-2'
})

async function signedInToBothWorkspaces(ws1ExpiresIn = 3600) {
  const harness = await signedIn(ws1ExpiresIn)
  harness.page.url = 'http://127.0.0.1:8188/?code=code-2&state=state-2'
  harness.storage.setItem(
    PENDING_KEY,
    JSON.stringify({ verifier: 'verifier-2', state: 'state-2' })
  )
  harness.env.fetchImpl.mockResolvedValueOnce(
    tokenResponse(WS2_TOKEN, 'refresh-ws2')
  )
  await harness.bridge.completeSignIn()
  harness.env.fetchImpl.mockClear()
  harness.states.length = 0
  return harness
}

describe('switchWorkspace', () => {
  it('stays on the current workspace without leaving the page', async () => {
    const { bridge, env } = await signedIn()

    await expect(bridge.switchWorkspace?.('ws-1')).resolves.toMatchObject({
      status: 'signed_in',
      workspaceId: 'ws-1'
    })
    expect(authorizeUrlOf(env)).toBeUndefined()
  })

  it('goes to consent for a workspace this page never signed in to', async () => {
    const { bridge, env } = await signedIn()

    void bridge.switchWorkspace?.('ws-2')

    await authorized(env)
    expect(authorizeRequest(env).pathname).toBe('/oauth/authorize')
  })

  it('switches straight back to a workspace it signed in to before', async () => {
    const { bridge, env, states } = await signedInToBothWorkspaces()

    await expect(bridge.switchWorkspace?.('ws-1')).resolves.toMatchObject({
      status: 'signed_in',
      workspaceId: 'ws-1'
    })
    expect(states.at(-1)).toMatchObject({ workspaceId: 'ws-1' })
    await expect(bridge.getWorkspaceToken('ws-1')).resolves.toBe(WS1_TOKEN)
    expect(authorizeUrlOf(env)).toBeUndefined()
    expect(env.fetchImpl).not.toHaveBeenCalled()
  })

  it('refreshes the kept tokens of an expired workspace before switching to it', async () => {
    const { bridge, env, clock } = await signedInToBothWorkspaces(30)
    clock.now += 60_000
    env.fetchImpl.mockResolvedValueOnce(tokenResponse(WS1_TOKEN, 'refresh-3'))

    await expect(bridge.switchWorkspace?.('ws-1')).resolves.toMatchObject({
      workspaceId: 'ws-1'
    })
    expect(formOf(env.fetchImpl.mock.calls[0][1])).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1'
    })
    expect(authorizeUrlOf(env)).toBeUndefined()
  })

  it('keeps the workspace it leaves, even one signed in to before workspaces were kept', async () => {
    const { bridge, env, tokens } = setup()
    tokens.write({
      accessToken: WS1_TOKEN,
      refreshToken: 'refresh-1',
      expiresAt: NOW + 3_600_000,
      scope: 'comfy-cloud:user:read'
    })

    void bridge.switchWorkspace?.('ws-2')

    await authorized(env)
    expect(tokens.readWorkspace('ws-1')?.accessToken).toBe(WS1_TOKEN)
  })

  it('stays signed out when sign-out lands while a switch is refreshing', async () => {
    const harness = setup('http://127.0.0.1:8188/?code=code-1&state=state-1', {
      withRefreshLock: handOverLock()
    })
    const { bridge, env, tokens, clock, storage, page } = harness
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
    )
    env.fetchImpl.mockResolvedValueOnce(
      tokenResponse(WS1_TOKEN, 'refresh-1', 30)
    )
    await bridge.completeSignIn()
    page.url = 'http://127.0.0.1:8188/?code=code-2&state=state-2'
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-2', state: 'state-2' })
    )
    env.fetchImpl.mockResolvedValueOnce(tokenResponse(WS2_TOKEN, 'refresh-ws2'))
    await bridge.completeSignIn()
    clock.now += 60_000
    let answer: (response: Response) => void = () => {}
    env.fetchImpl.mockImplementation(
      () => new Promise((resolve) => (answer = resolve))
    )

    const switching = bridge.switchWorkspace?.('ws-1')
    await vi.waitFor(() => expect(env.fetchImpl).toHaveBeenCalledTimes(3))
    const signingOut = bridge.signOut()
    answer(tokenResponse(WS1_TOKEN, 'refresh-3'))
    await switching
    await signingOut

    expect(tokens.read()).toBeUndefined()
    expect(tokens.readWorkspace('ws-1')).toBeUndefined()
  })

  it('keeps the session and stays put when the kept workspace cannot be refreshed right now', async () => {
    const { bridge, env, clock } = await signedInToBothWorkspaces(30)
    clock.now += 60_000
    env.fetchImpl.mockRejectedValueOnce(new TypeError('network down'))

    await expect(bridge.switchWorkspace?.('ws-1')).resolves.toMatchObject({
      status: 'signed_in',
      workspaceId: 'ws-2'
    })
    expect(authorizeUrlOf(env)).toBeUndefined()
  })

  it('never switches into tokens another account left behind', async () => {
    const { bridge, env, tokens } = await signedIn()
    tokens.writeWorkspace('ws-2', {
      accessToken: accessToken({ sub: 'user-2', workspace_id: 'ws-2' }),
      refreshToken: 'refresh-other',
      expiresAt: NOW + 3_600_000,
      scope: 'comfy-cloud:user:read'
    })

    void bridge.switchWorkspace?.('ws-2')

    await authorized(env)
    await expect(bridge.getState()).resolves.toMatchObject({ userId: 'user-1' })
  })

  it('forgets the previous account when a different one signs in', async () => {
    const harness = await signedInToBothWorkspaces()
    const { bridge, env, tokens, storage, page } = harness
    page.url = 'http://127.0.0.1:8188/?code=code-3&state=state-3'
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-3', state: 'state-3' })
    )
    env.fetchImpl.mockResolvedValueOnce(
      tokenResponse(
        accessToken({ sub: 'user-2', workspace_id: 'ws-9' }),
        'refresh-user-2'
      )
    )

    await bridge.completeSignIn()

    expect(tokens.readWorkspace('ws-1')).toBeUndefined()
    expect(tokens.readWorkspace('ws-2')).toBeUndefined()
    await expect(bridge.getState()).resolves.toMatchObject({
      userId: 'user-2',
      workspaceId: 'ws-9'
    })
  })

  it('does not go to consent when sign-out lands before a switch falls back to it', async () => {
    const harness = setup(undefined, { withRefreshLock: handOverLock() })
    const { bridge, env, tokens } = harness
    tokens.write({
      accessToken: WS1_TOKEN,
      refreshToken: 'refresh-1',
      expiresAt: NOW + 3_600_000,
      scope: 'comfy-cloud:user:read'
    })

    const switching = bridge.switchWorkspace?.('ws-2')
    const signingOut = bridge.signOut()

    await expect(switching).resolves.toEqual({ status: 'signed_out' })
    await signingOut
    expect(authorizeUrlOf(env)).toBeUndefined()
  })

  it('stays put without reporting a switch when the tab cannot remember the workspace', async () => {
    const { bridge, env, storage, states } = await signedInToBothWorkspaces()
    const setItem = storage.setItem
    storage.setItem = (key, value) => {
      if (key === TAB_WORKSPACE_KEY) throw new DOMException('full')
      setItem(key, value)
    }

    await expect(bridge.switchWorkspace?.('ws-1')).resolves.toMatchObject({
      workspaceId: 'ws-2'
    })
    expect(states).toEqual([])
    expect(authorizeUrlOf(env)).toBeUndefined()
  })

  it('drops a switch consent that comes back after sign-out', async () => {
    const { bridge, env, storage, popup, post, tokens } = await signedIn()
    const switching = bridge.switchWorkspace?.('ws-2')
    await authorized(env)
    const { state } = JSON.parse(storage.getItem(PENDING_KEY) ?? '')

    await bridge.signOut()
    post({
      origin: ISSUER,
      source: popup,
      data: {
        type: 'comfy-local-web-sign-in',
        search: `?code=code-2&state=${encodeURIComponent(state)}`
      }
    })

    await expect(switching).resolves.toEqual({ status: 'signed_out' })
    expect(env.fetchImpl).not.toHaveBeenCalled()
    expect(tokens.read()).toBeUndefined()
  })

  it('drops a switch consent whose code exchange finishes after sign-out', async () => {
    const { bridge, env, storage, popup, post, tokens } = await signedIn()
    let answer: (response: Response) => void = () => {}
    env.fetchImpl.mockImplementation(
      () => new Promise((resolve) => (answer = resolve))
    )
    const switching = bridge.switchWorkspace?.('ws-2')
    await authorized(env)
    const { state } = JSON.parse(storage.getItem(PENDING_KEY) ?? '')
    post({
      origin: ISSUER,
      source: popup,
      data: {
        type: 'comfy-local-web-sign-in',
        search: `?code=code-2&state=${encodeURIComponent(state)}`
      }
    })
    await vi.waitFor(() => expect(env.fetchImpl).toHaveBeenCalledOnce())

    await bridge.signOut()
    answer(tokenResponse(WS2_TOKEN, 'refresh-ws2'))

    await expect(switching).resolves.toEqual({ status: 'signed_out' })
    expect(tokens.read()).toBeUndefined()
    expect(env.reportSignInFailure).not.toHaveBeenCalled()
  })

  function freshPopup() {
    const popup = {
      closed: false,
      close() {
        popup.closed = true
      },
      location: { href: 'about:blank' }
    }
    return popup
  }

  it.for([
    {
      case: 'a switch consent popup is open',
      start: (bridge: LocalWebAuthBridge) => bridge.switchWorkspace?.('ws-2')
    },
    {
      case: 'a sign-in is still preparing its request',
      start: (bridge: LocalWebAuthBridge) => bridge.requestSignIn()
    }
  ])(
    'gives a sign-in after sign-out its own popup when $case',
    async ({ start }) => {
      const { bridge, env, storage, popup, post } = await signedIn()
      const second = freshPopup()
      env.openPopup.mockReturnValueOnce(popup).mockReturnValueOnce(second)
      const canceled = start(bridge)

      await bridge.signOut()
      const signingIn = bridge.requestSignIn()
      await vi.waitFor(() =>
        expect(second.location.href).toContain('/oauth/authorize')
      )
      const { state } = JSON.parse(storage.getItem(PENDING_KEY) ?? '')
      post({
        origin: ISSUER,
        source: second,
        data: {
          type: 'comfy-local-web-sign-in',
          search: `?code=code-3&state=${encodeURIComponent(state)}`
        }
      })

      expect(popup.closed).toBe(true)
      await expect(canceled).resolves.toEqual({ status: 'signed_out' })
      await expect(signingIn).resolves.toMatchObject({ status: 'signed_in' })
      expect(env.reportSignInFailure).not.toHaveBeenCalled()
    }
  )

  it('forgets a kept workspace whose refresh is refused and asks for consent on the next click', async () => {
    const { bridge, env, clock, tokens } = await signedInToBothWorkspaces(30)
    clock.now += 60_000
    env.fetchImpl.mockResolvedValueOnce(oauthError('invalid_grant'))

    await expect(bridge.switchWorkspace?.('ws-1')).resolves.toMatchObject({
      status: 'signed_in',
      workspaceId: 'ws-2'
    })
    expect(env.openPopup).not.toHaveBeenCalled()
    expect(tokens.readWorkspace('ws-1')).toBeUndefined()

    void bridge.switchWorkspace?.('ws-1')

    expect(env.openPopup).toHaveBeenCalledOnce()
  })

  it('keeps tokens written for the workspace while its refused refresh was in flight', async () => {
    const { bridge, env, clock, tokens } = await signedInToBothWorkspaces(30)
    clock.now += 60_000
    let answer: (response: Response) => void = () => {}
    env.fetchImpl.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve))
    )
    const switching = bridge.switchWorkspace?.('ws-1')
    await vi.waitFor(() => expect(env.fetchImpl).toHaveBeenCalledOnce())
    const renewed = {
      accessToken: WS1_TOKEN,
      refreshToken: 'refresh-newer',
      expiresAt: clock.now + 3_600_000,
      scope: 'comfy-cloud:user:read'
    }
    tokens.writeWorkspace('ws-1', renewed)

    answer(oauthError('invalid_grant'))
    await switching

    expect(tokens.readWorkspace('ws-1')).toEqual(renewed)
  })

  it('forgets every workspace on sign-out', async () => {
    const { bridge, env, tokens } = await signedInToBothWorkspaces()
    await bridge.signOut()
    expect(tokens.readWorkspace('ws-1')).toBeUndefined()
    expect(tokens.readWorkspace('ws-2')).toBeUndefined()

    void bridge.switchWorkspace?.('ws-1')

    await authorized(env)
  })
})

function handOverLock(): LocalWebAuthEnvironment['withRefreshLock'] {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task)
    tail = run.catch(() => undefined)
    return run.then(
      (value) => new Promise<T>((resolve) => setTimeout(() => resolve(value)))
    )
  }
}

function storageEvent(key: string | null): Event {
  return Object.assign(new Event('storage'), { key })
}

function serialLock(): LocalWebAuthEnvironment['withRefreshLock'] {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task)
    tail = run.catch(() => undefined)
    return run
  }
}

describe('across tabs sharing stored tokens', () => {
  function tabs() {
    const shared = memoryStorage()
    const events = new EventTarget()
    const withRefreshLock = serialLock()
    const open = () =>
      setup(undefined, {
        tokens: createStorageTokenStore(shared, events),
        withRefreshLock
      })
    const first = open()
    first.tokens.write({
      accessToken: WS1_TOKEN,
      refreshToken: 'refresh-1',
      expiresAt: NOW + 30_000,
      scope: 'comfy-cloud:user:read'
    })
    return { first, second: open(), events }
  }

  it('keeps another tab on its workspace when this tab switches in place', async () => {
    const { first, second, events } = tabs()
    await second.bridge.getState()
    first.tokens.writeWorkspace('ws-2', {
      accessToken: WS2_TOKEN,
      refreshToken: 'refresh-ws2',
      expiresAt: NOW + 3_600_000,
      scope: 'comfy-cloud:user:read'
    })

    await expect(first.bridge.switchWorkspace?.('ws-2')).resolves.toMatchObject(
      { workspaceId: 'ws-2' }
    )
    events.dispatchEvent(storageEvent(null))

    await expect(second.bridge.getState()).resolves.toMatchObject({
      workspaceId: 'ws-1'
    })
    second.clock.now = NOW - 120_000
    await expect(second.bridge.getWorkspaceToken('ws-1')).resolves.toBe(
      WS1_TOKEN
    )
  })

  it('keeps another tab on its workspace when this tab switches through consent', async () => {
    const { first, second, events } = tabs()
    await second.bridge.getState()
    first.page.url = 'http://127.0.0.1:8188/?code=code-2&state=state-2'
    first.storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-2', state: 'state-2' })
    )
    first.env.fetchImpl.mockResolvedValueOnce(
      tokenResponse(WS2_TOKEN, 'refresh-ws2')
    )

    await first.bridge.completeSignIn()
    events.dispatchEvent(storageEvent(null))

    await expect(first.bridge.getState()).resolves.toMatchObject({
      workspaceId: 'ws-2'
    })
    await expect(second.bridge.getState()).resolves.toMatchObject({
      workspaceId: 'ws-1'
    })
  })

  it('stays signed in after a reload without asking the token endpoint', async () => {
    const { second } = tabs()

    await expect(second.bridge.getState()).resolves.toMatchObject({
      status: 'signed_in'
    })
    second.clock.now = NOW - 120_000
    await expect(second.bridge.getWorkspaceToken('ws-1')).resolves.toBe(
      WS1_TOKEN
    )
    expect(second.env.fetchImpl).not.toHaveBeenCalled()
  })

  it('uses the refresh another tab already made instead of spending the rotated-away refresh token', async () => {
    const { first, second } = tabs()
    const renewed = accessToken({ sub: 'user-1', workspace_id: 'ws-1', n: 2 })
    first.env.fetchImpl.mockImplementation(async () =>
      tokenResponse(renewed, 'refresh-2')
    )
    second.env.fetchImpl.mockImplementation(async () =>
      oauthError('invalid_grant')
    )

    const tokens = await Promise.all([
      first.bridge.getWorkspaceToken('ws-1'),
      second.bridge.getWorkspaceToken('ws-1')
    ])

    expect(tokens).toEqual([renewed, renewed])
    expect(first.env.fetchImpl).toHaveBeenCalledOnce()
    expect(second.env.fetchImpl).not.toHaveBeenCalled()
    expect(second.tokens.read()?.refreshToken).toBe('refresh-2')
  })

  it('signs out only after another tab finishes its refresh, so the refresh cannot restore the tokens', async () => {
    const { first, second } = tabs()
    let answer: (response: Response) => void = () => {}
    first.env.fetchImpl.mockImplementation(
      () => new Promise((resolve) => (answer = resolve))
    )
    const refresh = first.bridge.getWorkspaceToken('ws-1')
    await vi.waitFor(() => expect(first.env.fetchImpl).toHaveBeenCalledOnce())

    const signOut = second.bridge.signOut()
    await Promise.resolve()
    expect(second.tokens.read()?.refreshToken).toBe('refresh-1')

    answer(tokenResponse(WS1_TOKEN, 'refresh-2'))
    await refresh
    await expect(signOut).resolves.toEqual({ status: 'signed_out' })
    expect(first.tokens.read()).toBeUndefined()
  })

  it('does not go to consent when another tab signs out while this tab switches', async () => {
    const shared = memoryStorage()
    const events = new EventTarget()
    const withRefreshLock = handOverLock()
    const open = () =>
      setup(undefined, {
        tokens: createStorageTokenStore(shared, events),
        withRefreshLock
      })
    const switching = open()
    const signingOut = open()
    switching.tokens.write({
      accessToken: WS1_TOKEN,
      refreshToken: 'refresh-1',
      expiresAt: NOW + 3_600_000,
      scope: 'comfy-cloud:user:read'
    })

    const switched = switching.bridge.switchWorkspace?.('ws-2')
    const signedOut = signingOut.bridge.signOut()

    await expect(switched).resolves.toEqual({ status: 'signed_out' })
    await signedOut
    expect(authorizeUrlOf(switching.env)).toBeUndefined()
  })

  it('keeps a tab on its workspace, signed out, when that workspace has no tokens left', async () => {
    const { bridge, tokens, storage } = setup()
    storage.setItem(TAB_WORKSPACE_KEY, 'ws-1')
    tokens.write({
      accessToken: WS2_TOKEN,
      refreshToken: 'refresh-ws2',
      expiresAt: NOW + 3_600_000,
      scope: 'comfy-cloud:user:read'
    })

    await expect(bridge.getState()).resolves.toEqual({ status: 'signed_out' })
    expect(storage.getItem(TAB_WORKSPACE_KEY)).toBe('ws-1')
  })

  it('reports a sign-in whose workspace it could not keep and leaves new tabs on the old tokens', async () => {
    const memory = createMemoryTokenStore()
    const { bridge, env, storage } = setup(
      'http://127.0.0.1:8188/?code=code-1&state=state-1',
      { tokens: { ...memory, writeWorkspace: () => false } }
    )
    storage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
    )
    env.fetchImpl.mockResolvedValueOnce(tokenResponse(WS1_TOKEN, 'refresh-1'))

    await expect(bridge.completeSignIn()).resolves.toEqual({
      kind: 'failed',
      reason: 'storage-unavailable'
    })
    expect(memory.read()).toBeUndefined()
  })

  it('signs this tab out when another tab forgets the workspace it is on', async () => {
    const { first, second, events } = tabs()
    await expect(second.bridge.getState()).resolves.toMatchObject({
      workspaceId: 'ws-1'
    })
    first.storage.setItem(TAB_WORKSPACE_KEY, 'ws-2')
    const kept = first.tokens.readWorkspace('ws-1')
    if (!kept) throw new Error('ws-1 tokens were not kept')

    first.tokens.forgetWorkspace('ws-1', kept)
    events.dispatchEvent(storageEvent('Comfy.LocalWebSignIn.WorkspaceTokens'))

    expect(second.states.at(-1)).toEqual({ status: 'signed_out' })
  })

  it('tells listeners when another tab signs out', async () => {
    const { first, second, events } = tabs()

    await first.bridge.signOut()
    events.dispatchEvent(
      Object.assign(new Event('storage'), { key: LOCAL_WEB_TOKENS_KEY })
    )

    expect(second.states).toEqual([{ status: 'signed_out' }])
    await expect(second.bridge.getWorkspaceToken('ws-1')).resolves.toBeNull()
  })
})
