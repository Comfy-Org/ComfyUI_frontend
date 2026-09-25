import { fromPartial } from '@total-typescript/shoehorn'
import type { User, UserCredential } from 'firebase/auth'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import type { useExtensionService } from '@/services/extensionService'
import { useAuthStore } from '@/stores/authStore'
import type { ComfyExtension } from '@/types/comfy'

type IdentityObserver = (user: User | null) => void

const identity = vi.hoisted(() => {
  const userObservers = new Set<IdentityObserver>()
  const tokenObservers = new Set<IdentityObserver>()
  const state: { user: User | null } = { user: null }
  return {
    userObservers,
    tokenObservers,
    state,
    reset() {
      userObservers.clear()
      tokenObservers.clear()
      state.user = null
    },
    signIn(user: User) {
      state.user = user
      userObservers.forEach((observer) => observer(user))
      tokenObservers.forEach((observer) => observer(user))
    },
    refreshIdToken() {
      tokenObservers.forEach((observer) => observer(state.user))
    },
    signOut() {
      state.user = null
      userObservers.forEach((observer) => observer(null))
      tokenObservers.forEach((observer) => observer(null))
    }
  }
})

const firebaseSignOut = vi.hoisted(() => vi.fn<() => Promise<void>>())
const registeredExtensions = vi.hoisted((): ComfyExtension[] => [])

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@/platform/auth/firebaseIdentity'), () => ({
  firebaseIdentity: fromPartial<FirebaseIdentity>({
    onUserChanged: (observer: IdentityObserver) => {
      identity.userObservers.add(observer)
      return () => identity.userObservers.delete(observer)
    },
    onTokenChanged: (observer: IdentityObserver) => {
      identity.tokenObservers.add(observer)
      return () => identity.tokenObservers.delete(observer)
    },
    currentUser: () => identity.state.user,
    signInWithEmail: async () => {
      identity.signIn(USER_A)
      return fromPartial<UserCredential>({ user: USER_A })
    },
    signOut: firebaseSignOut
  })
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (extension: ComfyExtension) => {
        registeredExtensions.push(extension)
      }
    })
}))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

await import('@/extensions/core/cloudSessionCookie')

const TEN_MINUTES_MS = 10 * 60 * 1000

const USER_A = fromPartial<User>({
  uid: 'user-a',
  getIdToken: async () => 'firebase-id-token'
})

type ServerSession = 'none' | 'revoked' | { userId: string }

interface SessionRequest {
  method: string
  authorization: string | null
  credentials: RequestCredentials | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function sessionBody(userId: string) {
  return {
    user: {
      id: userId,
      email: `${userId}@example.com`,
      email_verified: true
    },
    csrf_token: `csrf-${userId}`,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 604_800_000).toISOString()
  }
}

function installServer(initial: ServerSession) {
  const server = { session: initial, requests: [] as SessionRequest[] }

  const answerSession = (method: string): Response => {
    if (method === 'POST') {
      server.session = { userId: 'user-a' }
      return jsonResponse({ success: true })
    }
    if (method === 'DELETE') {
      server.session = 'revoked'
      return jsonResponse({ success: true })
    }
    const { session } = server
    if (typeof session === 'object')
      return jsonResponse(sessionBody(session.userId))
    const code = session === 'revoked' ? 'session_revoked' : 'no_session'
    return jsonResponse({ code, message: code }, 401)
  }

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), location.href)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.pathname === '/api/features') {
        return jsonResponse({ unified_web_session: true })
      }
      if (url.pathname !== '/api/auth/session') {
        return jsonResponse({ id: 'customer-1' }, 201)
      }
      server.requests.push({
        method,
        authorization: new Headers(init?.headers).get('authorization'),
        credentials: init?.credentials ?? null
      })
      return answerSession(method)
    })
  )
  return server
}

function wireSessionCookieExtension() {
  const extension = registeredExtensions.find(
    ({ name }) => name === 'Comfy.Cloud.SessionCookie'
  )
  assert.exists(extension)
  const scope = effectScope()
  scope.run(() => {
    const { onUserResolved, onTokenRefreshed, onUserLogout } = useCurrentUser()
    onUserResolved(
      (user) =>
        void extension.onAuthUserResolved?.(user, fromPartial<ComfyApp>({}))
    )
    onTokenRefreshed(() => void extension.onAuthTokenRefreshed?.())
    onUserLogout(() => void extension.onAuthUserLogout?.())
  })
  return scope
}

const methodsOf = (requests: SessionRequest[]) =>
  requests.map(({ method }) => method)

describe('cloud app on the shared web session (unified_web_session on)', () => {
  let hooks: ReturnType<typeof effectScope> | undefined

  beforeEach(() => {
    identity.reset()
    firebaseSignOut.mockReset()
    firebaseSignOut.mockImplementation(async () => identity.signOut())
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    hooks?.stop()
    hooks = undefined
    remoteConfig.value = {}
  })

  it('creates the session once per interactive sign-in, never on refresh, and deletes it on sign-out', async () => {
    const server = installServer('none')
    await refreshRemoteConfig({ useAuth: false })

    await useAuthStore().login('user-a@example.com', 'password')
    hooks = wireSessionCookieExtension()
    await vi.waitFor(() =>
      expect(methodsOf(server.requests)).toEqual(['POST', 'GET', 'GET'])
    )
    expect(server.requests[0]).toEqual({
      method: 'POST',
      authorization: 'Bearer firebase-id-token',
      credentials: 'include'
    })
    server.requests.length = 0

    identity.refreshIdToken()
    identity.refreshIdToken()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(server.requests).toEqual([])

    await useAuthStore().logout()
    expect(server.requests).toEqual([
      { method: 'DELETE', authorization: null, credentials: 'include' }
    ])
    server.requests.length = 0

    await useAuthStore().login('user-a@example.com', 'password')
    await vi.waitFor(() =>
      expect(methodsOf(server.requests)).toEqual(['POST', 'GET'])
    )
  })

  it.for([
    {
      name: '200 for the remembered user signs in as is',
      session: { userId: 'user-a' },
      requests: ['GET'],
      signsOutLocally: false
    },
    {
      name: '200 for another user signs the remembered login out',
      session: { userId: 'user-b' },
      requests: ['GET'],
      signsOutLocally: true
    },
    {
      name: '401 session_revoked signs out and never restores',
      session: 'revoked',
      requests: ['GET'],
      signsOutLocally: true
    },
    {
      name: '401 no_session restores once from the remembered login',
      session: 'none',
      requests: ['GET', 'POST', 'GET'],
      signsOutLocally: false
    }
  ] satisfies {
    name: string
    session: ServerSession
    requests: string[]
    signsOutLocally: boolean
  }[])('boot: $name', async ({ session, requests, signsOutLocally }) => {
    const server = installServer(session)
    await refreshRemoteConfig({ useAuth: false })
    identity.signIn(USER_A)

    await useSessionCookie().ensureSessionCookie()

    expect(methodsOf(server.requests)).toEqual(requests)
    expect(firebaseSignOut).toHaveBeenCalledTimes(signsOutLocally ? 1 : 0)
  })

  it('resets the tab and tells the user when another account takes the session', async () => {
    const server = installServer({ userId: 'user-a' })
    await refreshRemoteConfig({ useAuth: false })
    identity.signIn(USER_A)
    await useSessionCookie().ensureSessionCookie()
    sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE, 'ws-team')
    firebaseSignOut.mockResolvedValue()

    server.session = { userId: 'user-b' }
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)

    expect(firebaseSignOut).toHaveBeenCalledOnce()
    expect(api.resetSocket).toHaveBeenCalledOnce()
    expect(
      sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
    ).toBeNull()
    expect(useToastStore().messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'info',
        detail: expect.stringContaining('user-b@example.com')
      })
    ])
  })
})
