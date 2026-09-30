import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { getActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { COMFY_CLIENT } from '@comfyorg/account-core/requestAuth'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

type IdentityObserver = (user: User | null) => void

const firebaseSignOut = vi.hoisted(() => vi.fn(async () => {}))

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

// Firebase holds no user: its listeners answer null once, as the SDK does.
vi.mock(import('@/platform/auth/firebaseIdentity'), () => ({
  firebaseIdentity: fromPartial<FirebaseIdentity>({
    onUserChanged: (observer: IdentityObserver) => {
      observer(null)
      return () => {}
    },
    onTokenChanged: (observer: IdentityObserver) => {
      observer(null)
      return () => {}
    },
    currentUser: () => null,
    signOut: firebaseSignOut
  })
}))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const SSO_USER_ID = '0b9d6f3e-5c1a-4f6e-9a61-2f4f1f7d8c21'

interface Recorded {
  method: string
  path: string
  headers: Record<string, string>
  credentials: RequestCredentials | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function record(input: RequestInfo | URL, init?: RequestInit): Recorded {
  return {
    method: (init?.method ?? 'GET').toUpperCase(),
    path: new URL(String(input), location.href).pathname,
    headers: Object.fromEntries(
      [...new Headers(init?.headers).entries()].map(([name, value]) => [
        name.toLowerCase(),
        value
      ])
    ),
    credentials: init?.credentials ?? null
  }
}

function installCloud({ probe = true, cohort = true } = {}) {
  const cloud = {
    signedIn: true,
    mints: 0,
    requests: [] as Recorded[]
  }

  const features = ({ headers, credentials }: Recorded): Response => {
    const credentialed =
      credentials === 'include' && headers['x-comfy-client'] === COMFY_CLIENT
    if (credentialed && cloud.signedIn) {
      return jsonResponse({ unified_web_session: cohort })
    }
    return jsonResponse({ web_session_probe: probe })
  }

  const respond = (request: Recorded): Response => {
    const { method, path } = request
    if (path === '/api/features') return features(request)
    if (path === '/api/auth/session' && method === 'DELETE') {
      cloud.signedIn = false
      return jsonResponse({ success: true })
    }
    if (path === '/api/auth/session') {
      if (!cloud.signedIn) {
        return jsonResponse({ code: 'no_session', message: 'none' }, 401)
      }
      return jsonResponse({
        user: {
          id: SSO_USER_ID,
          email: 'ada@acme.example',
          email_verified: true,
          sign_in_provider: 'saml.workos'
        },
        csrf_token: 'csrf-1',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        absolute_expires_at: new Date(Date.now() + 604_800_000).toISOString()
      })
    }
    if (path === '/api/auth/token') {
      cloud.mints += 1
      return jsonResponse({
        token: `session-jwt-${cloud.mints}`,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
        role: 'owner',
        permissions: []
      })
    }
    if (path.endsWith('/customers/balance')) {
      return jsonResponse({ amount_micros: 5_000_000, currency: 'usd' })
    }
    return jsonResponse({})
  }

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const request = record(input, init)
      cloud.requests.push(request)
      return respond(request)
    })
  )
  return cloud
}

const pathsOf = (requests: Recorded[]) =>
  requests.map(({ method, path }) => `${method} ${path}`)

/** A reload drops every store that holds the account; the cookie stays. */
function reloadPage() {
  const pinia = getActivePinia()
  for (const store of [useAuthStore(), useCloudWebSessionStore()]) {
    store.$dispose()
    if (pinia) delete pinia.state.value[store.$id]
  }
}

async function loadPage() {
  await refreshRemoteConfig({ useAuth: false })
  return useAuthStore()
}

describe('cloud app for a user with no Firebase login (unified_web_session on)', () => {
  beforeEach(() => {
    firebaseSignOut.mockClear()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
    vi.spyOn(api, 'reconnectSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  it('boots from the session cookie alone and knows the session user', async () => {
    const cloud = installCloud()
    const authStore = await loadPage()
    cloud.requests.length = 0

    expect(authStore.isInitialized).toBe(true)
    expect(useCurrentUser().isLoggedIn.value).toBe(false)
    await expect(authStore.signInFromSession()).resolves.toBe(true)

    expect(pathsOf(cloud.requests)).toEqual([
      'GET /api/features',
      'GET /api/auth/session'
    ])
    expect(cloud.requests[0]).toMatchObject({
      headers: { 'x-comfy-client': COMFY_CLIENT },
      credentials: 'include'
    })
    expect(authStore.currentUser).toBeNull()
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.userId).toBe(SSO_USER_ID)
    expect(authStore.userEmail).toBe('ada@acme.example')
    expect(authStore.currentUserIdentity()).toBe(SSO_USER_ID)
    const { isLoggedIn, resolvedUserInfo, userEmail } = useCurrentUser()
    expect(isLoggedIn.value).toBe(true)
    expect(resolvedUserInfo.value).toEqual({ id: SSO_USER_ID })
    expect(userEmail.value).toBe('ada@acme.example')
  })

  it('boots again on reload, reading the session and never creating one', async () => {
    const cloud = installCloud()
    await (await loadPage()).signInFromSession()

    reloadPage()
    const authStore = await loadPage()

    await expect(authStore.signInFromSession()).resolves.toBe(true)
    expect(authStore.userId).toBe(SSO_USER_ID)
    const sessionCalls = cloud.requests.filter(
      ({ path }) => path === '/api/auth/session'
    )
    expect(pathsOf(sessionCalls)).toEqual([
      'GET /api/auth/session',
      'GET /api/auth/session'
    ])
  })

  it('reaches ingest on the cookie and comfy-api with the session-minted token', async () => {
    const cloud = installCloud()
    const authStore = await loadPage()
    await authStore.signInFromSession()
    cloud.requests.length = 0

    await api.fetchApi('/queue')
    const balance = await authStore.fetchBalance()

    expect(balance).toEqual({ amount_micros: 5_000_000, currency: 'usd' })
    const [queue, mint, customers] = cloud.requests
    expect(queue).toMatchObject({
      path: '/api/queue',
      credentials: 'include',
      headers: { 'x-comfy-client': COMFY_CLIENT }
    })
    expect(queue.headers).not.toHaveProperty('authorization')
    expect(mint).toMatchObject({
      method: 'POST',
      path: '/api/auth/token',
      credentials: 'include',
      headers: { 'x-csrf-token': 'csrf-1' }
    })
    expect(customers.path).toMatch(/\/customers\/balance$/)
    expect(customers.headers.authorization).toBe('Bearer session-jwt-1')
    await expect(authStore.getWorkspaceAuthToken()).resolves.toBe(
      'session-jwt-1'
    )
    expect(cloud.mints).toBe(1)
  })

  it('signs out on the session and forgets the user', async () => {
    const cloud = installCloud()
    const authStore = await loadPage()
    await authStore.signInFromSession()
    const loggedOut = vi.fn()
    const scope = effectScope()
    scope.run(() => useCurrentUser().onUserLogout(loggedOut))

    await authStore.logout()

    expect(cloud.requests.at(-1)).toMatchObject({
      method: 'DELETE',
      path: '/api/auth/session',
      credentials: 'include'
    })
    expect(authStore.userId).toBeUndefined()
    expect(authStore.isAuthenticated).toBe(false)
    await vi.waitFor(() => expect(loggedOut).toHaveBeenCalledOnce())
    await expect(authStore.signInFromSession()).resolves.toBe(false)
    scope.stop()
  })

  it.for([
    { name: 'the probe is off', probe: false, cohort: true, reads: [] },
    {
      name: 'the user is outside the cohort',
      probe: true,
      cohort: false,
      reads: ['GET /api/features']
    }
  ])(
    'stays signed out and leaves the page undecided when $name',
    async ({ probe, cohort, reads }) => {
      const cloud = installCloud({ probe, cohort })
      const authStore = await loadPage()
      cloud.requests.length = 0

      await expect(authStore.signInFromSession()).resolves.toBe(false)

      expect(pathsOf(cloud.requests)).toEqual(reads)
      expect(authStore.isAuthenticated).toBe(false)
      expect(useCloudWebSessionStore().isActive()).toBe(false)
    }
  )

  it('sends no session request for a stored API key', async () => {
    const cloud = installCloud()
    const authStore = await loadPage()
    vi.spyOn(useApiKeyAuthStore(), 'getApiKey').mockReturnValue('comfy-key')
    cloud.requests.length = 0

    await expect(authStore.signInFromSession()).resolves.toBe(false)
    expect(cloud.requests).toEqual([])
  })
})
