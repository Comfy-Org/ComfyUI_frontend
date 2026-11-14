import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  desktopHostWorkspaceToken,
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import { useLocalBillingWebFlagStore } from '@/platform/billing/stores/localBillingWebFlagStore'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('firebase/auth'))

const distribution = vi.hoisted(() => ({ isCloud: false, isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'localhost' as const,
  isNightly: false,
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

const FEATURES = /\/api\/features$/
const TEN_MINUTES_MS = 10 * 60_000

function signedIn(userId: string, workspaceId: string): DesktopHostAuthState {
  return { status: 'signed_in', userId, workspaceId }
}

function fakeBridge(initial: DesktopHostAuthState) {
  const listeners = new Set<(state: DesktopHostAuthState) => void>()
  const bridge = {
    getState: vi.fn(async () => initial),
    getWorkspaceToken: vi.fn(
      async (workspaceId: string): Promise<string | null> =>
        `token-${workspaceId}`
    ),
    requestSignIn: vi.fn(async () => initial),
    signOut: vi.fn(async (): Promise<DesktopHostAuthState> => ({
      status: 'signed_out'
    })),
    onChanged: vi.fn((callback: (state: DesktopHostAuthState) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    })
  } satisfies DesktopHostAuthBridge
  const push = (state: DesktopHostAuthState) =>
    listeners.forEach((listener) => listener(state))
  return { bridge, push }
}

function serveFlags(body: unknown) {
  respondToFetch(FEATURES, () => Response.json(body))
}

function pendingResponse() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((settleWith) => {
    resolve = settleWith
  })
  return { promise, resolve }
}

const settle = () => vi.advanceTimersByTimeAsync(0)

async function signInAndRead(state = signedIn('user-1', 'ws-1')) {
  const host = fakeBridge(state)
  await startDesktopHostSession(host.bridge)
  const store = useLocalBillingWebFlagStore()
  await settle()
  return { store, ...host }
}

describe('useLocalBillingWebFlagStore', () => {
  beforeEach(() => {
    Object.assign(distribution, { isCloud: false, isDesktop: false })
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue()
  })

  afterEach(() => stopDesktopHostSession())

  it('reads the flag on sign-in with the account credential', async () => {
    serveFlags({ local_billing_web: true })

    const { store } = await signInAndRead()

    expect(store.enabled).toBe(true)
    const [request] = fetchRequests(FEATURES)
    expect(request.url).toBe(`${getComfyCloudBaseUrl()}/api/features`)
    expect(request.headers.get('Authorization')).toBe('Bearer token-ws-1')
  })

  it('exposes only local_billing_web from a Cloud document with other keys', async () => {
    const localConfig = { ...useRemoteConfigStore().config }
    serveFlags({
      local_billing_web: true,
      unified_billing_settings: true,
      hosted_billing_destination: 'billing_web',
      billing_web_url: 'https://billing.example'
    })

    const { store } = await signInAndRead()

    expect(store.enabled).toBe(true)
    expect(useRemoteConfigStore().config).toEqual(localConfig)
  })

  it.for([
    {
      host: 'a browser',
      desktop2: false,
      desktopBuild: false,
      surface: 'local_web'
    },
    {
      host: 'Desktop',
      desktop2: true,
      desktopBuild: false,
      surface: 'desktop'
    },
    {
      host: 'a Desktop build',
      desktop2: false,
      desktopBuild: true,
      surface: 'desktop'
    }
  ])(
    'names the $surface surface when served to $host',
    async ({ desktop2, desktopBuild, surface }) => {
      distribution.isDesktop = desktopBuild
      if (desktop2) vi.stubGlobal('__comfyDesktop2', {})
      serveFlags({ local_billing_web: true })

      await signInAndRead()

      expect(fetchRequests(FEATURES)[0].headers.get('X-Comfy-Surface')).toBe(
        surface
      )
    }
  )

  it.for([
    {
      failure: 'a network error',
      respond: () => Promise.reject(new TypeError('offline'))
    },
    {
      failure: 'a non-2xx status',
      respond: () => Response.json({ local_billing_web: true }, { status: 500 })
    },
    { failure: 'a malformed body', respond: () => new Response('not json') },
    {
      failure: 'a missing key',
      respond: () => Response.json({ unified_billing_settings: true })
    },
    {
      failure: 'a non-boolean value',
      respond: () => Response.json({ local_billing_web: 'true' })
    }
  ])('is false after $failure', async ({ respond }) => {
    respondToFetch(FEATURES, respond)

    const { store } = await signInAndRead()

    expect(store.enabled).toBe(false)
  })

  it('is false without reading while no account is signed in', async () => {
    const store = useLocalBillingWebFlagStore()
    await settle()

    expect(store.enabled).toBe(false)
    expect(fetchRequests(FEATURES)).toEqual([])
  })

  it('never reads on Cloud', async () => {
    distribution.isCloud = true

    const { store } = await signInAndRead()

    expect(store.enabled).toBe(false)
    expect(fetchRequests(FEATURES)).toEqual([])
  })

  it('re-reads every ten minutes', async () => {
    serveFlags({ local_billing_web: false })
    const { store } = await signInAndRead()
    serveFlags({ local_billing_web: true })

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)

    expect(fetchRequests(FEATURES)).toHaveLength(2)
    expect(store.enabled).toBe(true)
  })

  it('clears the value before re-reading on a workspace switch', async () => {
    serveFlags({ local_billing_web: true })
    const { store, push } = await signInAndRead()
    const { promise: answer, resolve } = pendingResponse()
    respondToFetch(FEATURES, () => answer, { times: 1 })

    push(signedIn('user-1', 'ws-2'))
    await settle()

    expect(store.enabled).toBe(false)
    resolve(Response.json({ local_billing_web: true }))
    await settle()
    expect(store.enabled).toBe(true)
    expect(fetchRequests(FEATURES).at(-1)?.headers.get('Authorization')).toBe(
      'Bearer token-ws-2'
    )
  })

  it.for([
    { change: 'sign-out', next: { status: 'signed_out' } as const },
    { change: 'an account change', next: signedIn('user-2', 'ws-1') }
  ])('clears the value on $change', async ({ next }) => {
    serveFlags({ local_billing_web: true })
    const { store, push } = await signInAndRead()
    respondToFetch(FEATURES, () => new Promise<Response>(() => {}))

    push(next)
    await settle()

    expect(store.enabled).toBe(false)
  })

  it('drops a read that was in flight when the account signed out', async () => {
    const { promise: answer, resolve } = pendingResponse()
    respondToFetch(FEATURES, () => answer)
    const { store, push } = await signInAndRead()

    push({ status: 'signed_out' })
    await settle()
    resolve(Response.json({ local_billing_web: true }))
    await settle()

    expect(store.enabled).toBe(false)
  })

  it('turns on after a failed read, the session re-announcing the account and a successful re-read', async () => {
    const state = signedIn('user-1', 'ws-1')
    const host = fakeBridge(state)
    host.bridge.getWorkspaceToken.mockResolvedValueOnce(null)
    serveFlags({ local_billing_web: true })
    await startDesktopHostSession(host.bridge)
    const store = useLocalBillingWebFlagStore()
    await settle()
    expect(store.enabled).toBe(false)

    host.push(signedIn('user-1', 'ws-1'))
    await settle()

    expect(store.enabled).toBe(true)
  })

  it('turns on after a failed read, a token recovered by another request and a successful re-read', async () => {
    const host = fakeBridge(signedIn('user-1', 'ws-1'))
    host.bridge.getWorkspaceToken.mockResolvedValueOnce(null)
    serveFlags({ local_billing_web: true })
    await startDesktopHostSession(host.bridge)
    const store = useLocalBillingWebFlagStore()
    await settle()
    expect(store.enabled).toBe(false)

    await desktopHostWorkspaceToken('ws-1')
    await settle()

    expect(store.enabled).toBe(true)
  })

  it('never falls back to a stored API key for a signed-in account without a token', async () => {
    const authStore = useAuthStore()
    Object.assign(authStore, { userId: 'firebase-user' })
    vi.mocked(authStore.getIdToken).mockResolvedValue(undefined)
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
      'X-API-KEY': 'stored-key'
    })
    serveFlags({ local_billing_web: true })

    const store = useLocalBillingWebFlagStore()
    await settle()

    expect(store.enabled).toBe(false)
    expect(fetchRequests(FEATURES)).toEqual([])
  })
})
