import { fromPartial } from '@total-typescript/shoehorn'
import type { User, UserCredential } from 'firebase/auth'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { defineComponent, effectScope } from 'vue'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type {
  BillingBalanceResponse,
  BillingCapabilitiesResponse,
  BillingOpStatusResponse,
  BillingStatusResponse,
  CreateTopupResponse
} from '@comfyorg/ingest-types'
import { OPERATION_POLL_TIMING } from '@comfyorg/account-core/billing'
import { MISSING_CUSTOMER_MESSAGE } from '@comfyorg/account-core/customerRecovery'
import { COMFY_CLIENT } from '@comfyorg/account-core/requestAuth'
import { SessionTokenError } from '@comfyorg/account-core/sessionTokenMint'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  bootCloudIdentity,
  cloudSignIn
} from '@/platform/auth/session/cloudIdentityBoot'
import {
  markInteractiveSignIn,
  takeInteractiveSignIn
} from '@/platform/auth/session/interactiveSignInMarker'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { submitSurvey } from '@/platform/cloud/onboarding/auth'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import {
  WebSessionTokenError,
  webSessionRequests,
  webSessionResourceHeader,
  webSessionSend
} from '@/platform/auth/session/webSessionFetch'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { NoWorkspaceAccessError } from '@/platform/workspace/api/workspaceApiError'
import {
  getGlobalSetting,
  setGlobalSetting
} from '@/platform/settings/globalSettingsApi'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useBillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import type { useExtensionService } from '@/services/extensionService'
import { createDisposablePinia } from '@/testing/pinia'
import { useCustomerEventsService } from '@/services/customerEventsService'
import { NO_PERSONAL_WORKSPACE, useAuthStore } from '@/stores/authStore'
import type { ComfyExtension } from '@/types/comfy'
import {
  resultItemUrl,
  resultItemVhsAdvancedPreviewUrl
} from '@/utils/resultItemUrl'

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
    resolve(user: User | null) {
      state.user = user
      userObservers.forEach((observer) => observer(user))
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

vi.mock(import('@/views/layouts/LayoutDefault.vue'), async () => ({
  default: defineComponent({ render: () => null })
}))

vi.mock(import('@/views/UserSelectView.vue'), async () => ({
  default: defineComponent({ render: () => null })
}))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/telemetry/reportError'))

await import('@/extensions/core/cloudSessionCookie')
const { default: router } = await import('@/router')

const TEN_MINUTES_MS = 10 * 60 * 1000

const cookieRevokeAll = {
  authorization: null,
  client: COMFY_CLIENT,
  csrf: 'csrf-user-a'
}

const USER_A = fromPartial<User>({
  uid: 'user-a',
  getIdToken: async () => 'firebase-id-token'
})

const USER_B = fromPartial<User>({
  uid: 'user-b',
  email: 'user-b@example.com',
  displayName: 'Firebase B',
  photoURL: 'https://example.com/b.png',
  providerData: [{ providerId: 'password' }],
  getIdToken: async () => 'firebase-id-token-b'
})

type ServerSession =
  | 'none'
  | 'revoked'
  | 'network'
  | 'restore_token_revoked'
  | { userId: string }

interface FeatureAnswers {
  probe: boolean
  anonymous: boolean
  credentialed: boolean
}

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

function sessionBody(userId: string, hasPersonalWorkspace?: boolean) {
  return {
    user: {
      id: userId,
      email: `${userId}@example.com`,
      email_verified: true,
      sign_in_provider: 'google.com',
      ...(hasPersonalWorkspace !== undefined && {
        has_personal_workspace: hasPersonalWorkspace
      })
    },
    csrf_token: `csrf-${userId}`,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 604_800_000).toISOString()
  }
}

function installServer(
  initial: ServerSession,
  features: Record<string, boolean> = {},
  answers?: FeatureAnswers
) {
  const server = {
    session: initial,
    requests: [] as SessionRequest[],
    dropPosts: false,
    revokeAllStatus: 200,
    revokeAllRequests: [] as {
      authorization: string | null
      client: string | null
      csrf: string | null
    }[],
    featureReads: [] as {
      credentials: RequestCredentials | null
      client: string | null
    }[]
  }

  const answerCreate = (): Response => {
    if (server.dropPosts) throw new TypeError('reloaded')
    if (server.session === 'restore_token_revoked') {
      return jsonResponse({ code: 'TOKEN_REVOKED', message: 'revoked' }, 401)
    }
    server.session = { userId: 'user-a' }
    return jsonResponse({ success: true })
  }

  const answerRead = (): Response => {
    const { session } = server
    if (session === 'network') {
      return jsonResponse({ code: 'unavailable', message: 'down' }, 503)
    }
    if (typeof session === 'object')
      return jsonResponse(sessionBody(session.userId))
    const code = session === 'revoked' ? 'session_revoked' : 'no_session'
    return jsonResponse({ code, message: code }, 401)
  }

  const answerSession = (method: string): Response => {
    if (method === 'POST') return answerCreate()
    if (method === 'DELETE') {
      server.session = 'revoked'
      return jsonResponse({ success: true })
    }
    return answerRead()
  }

  const answerRevokeAll = (init: RequestInit | undefined): Response => {
    const headers = new Headers(init?.headers)
    server.revokeAllRequests.push({
      authorization: headers.get('authorization'),
      client: headers.get('x-comfy-client'),
      csrf: headers.get('x-csrf-token')
    })
    if (server.revokeAllStatus !== 200) {
      const error = { code: 'unavailable', message: 'down' }
      return jsonResponse(error, server.revokeAllStatus)
    }
    server.session = 'revoked'
    return jsonResponse({ revoked: 2 })
  }

  const answerFeatures = (init: RequestInit | undefined): Response => {
    const client = new Headers(init?.headers).get('x-comfy-client')
    const credentials = init?.credentials ?? null
    server.featureReads.push({ credentials, client })
    if (!answers)
      return jsonResponse({ unified_web_session: true, ...features })
    const credentialed = client !== null && credentials === 'include'
    return jsonResponse({
      ...features,
      unified_web_session: credentialed
        ? answers.credentialed
        : answers.anonymous,
      ...(answers.probe && !credentialed && { web_session_probe: true })
    })
  }

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), location.href)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.pathname === '/api/features') return answerFeatures(init)
      if (url.pathname === '/api/auth/sessions/revoke-all') {
        return answerRevokeAll(init)
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
      signsOutLocally: false,
      outcome: 'signed_in'
    },
    {
      name: '200 for another user signs the remembered login out',
      session: { userId: 'user-b' },
      requests: ['GET'],
      signsOutLocally: true,
      outcome: 'signed_in'
    },
    {
      name: '401 session_revoked signs out and never restores',
      session: 'revoked',
      requests: ['GET'],
      signsOutLocally: true,
      outcome: 'revoked'
    },
    {
      name: '401 no_session restores once from the remembered login',
      session: 'none',
      requests: ['GET', 'POST', 'GET'],
      signsOutLocally: false,
      outcome: 'restored'
    }
  ] satisfies {
    name: string
    session: ServerSession
    requests: string[]
    signsOutLocally: boolean
    outcome: string
  }[])(
    'boot: $name',
    async ({ session, requests, signsOutLocally, outcome }) => {
      const server = installServer(session)
      await refreshRemoteConfig({ useAuth: false })
      identity.signIn(USER_A)

      await useSessionCookie().ensureSessionCookie()

      expect(methodsOf(server.requests)).toEqual(requests)
      expect(firebaseSignOut).toHaveBeenCalledTimes(signsOutLocally ? 1 : 0)
      expect(
        useTelemetry()?.trackWebSessionEvent
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'session_bootstrap',
        properties: { outcome, origin: location.origin }
      })
    }
  )

  it('reports a session revoked under a signed-in tab as signed out remotely', async () => {
    const server = installServer({ userId: 'user-a' })
    await refreshRemoteConfig({ useAuth: false })
    identity.signIn(USER_A)
    await useSessionCookie().ensureSessionCookie()

    server.session = 'revoked'
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)

    expect(useTelemetry()?.trackWebSessionEvent).toHaveBeenLastCalledWith({
      name: 'session_signed_out_remotely',
      properties: { origin: location.origin }
    })
  })

  it.for([
    { name: 'ok revokes every session', status: 200, result: { status: 'ok' } },
    {
      name: 'a server failure is returned, not thrown',
      status: 503,
      result: { status: 'error', code: 'SESSION_UNAVAILABLE' }
    }
  ])('revoke-all: $name', async ({ status, result }) => {
    const server = installServer({ userId: 'user-a' })
    server.revokeAllStatus = status
    await refreshRemoteConfig({ useAuth: false })
    identity.signIn(USER_A)
    await useSessionCookie().ensureSessionCookie()
    const webSession = useCloudWebSessionStore()

    expect(await webSession.revokeAllSessions()).toMatchObject(result)
    expect(server.revokeAllRequests).toEqual([cookieRevokeAll])
  })

  it('revoke-all works on a session-only tab with no Firebase login', async () => {
    const server = installServer({ userId: 'user-a' })
    await refreshRemoteConfig({ useAuth: false })
    await useSessionCookie().ensureSessionCookie()
    const webSession = useCloudWebSessionStore()
    expect(webSession.state.phase).toBe('signed_in')

    expect(await webSession.revokeAllSessions()).toEqual({ status: 'ok' })
    expect(server.revokeAllRequests).toEqual([cookieRevokeAll])
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

interface ApiRequest {
  method: string
  path: string
  headers: Record<string, string>
  credentials: RequestCredentials | null
}

function recordApiRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): ApiRequest {
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

function currentWorkspaceResponse(workspaceId: string | undefined): Response {
  if (workspaceId === 'ws-gone') {
    return jsonResponse({ code: 'workspace_access_denied', message: 'no' }, 403)
  }
  const isTeam = workspaceId === 'ws-team'
  return jsonResponse({
    id: workspaceId ?? 'ws-personal',
    name: isTeam ? 'Team' : 'Personal',
    type: isTeam ? 'team' : 'personal',
    role: 'owner',
    auth_method: 'web_session',
    permissions: ['owner:*']
  })
}

function mintBodyWorkspace(body: unknown): string {
  const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : {}
  const workspaceId =
    typeof parsed === 'object' && parsed !== null && 'workspace_id' in parsed
      ? parsed.workspace_id
      : undefined
  return typeof workspaceId === 'string' ? workspaceId : 'personal'
}

interface BillingScope {
  userId: string
  workspaceId: string
}

function capabilitiesResponse({
  userId,
  workspaceId
}: BillingScope): BillingCapabilitiesResponse {
  return {
    resolved_for: { user_id: userId, workspace_id: workspaceId },
    capabilities: {
      can_subscribe_self_serve: true,
      can_top_up: true,
      can_cancel: true,
      can_reactivate: false,
      can_revert_scheduled_change: false,
      can_change_seats: false,
      can_invite_members: false,
      can_downgrade_to_personal: false
    },
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    revision: 1,
    expires_at: new Date(Date.now() + TEN_MINUTES_MS).toISOString()
  }
}

function billingAnswer(path: string, scope: BillingScope): unknown {
  switch (path) {
    case '/api/billing/status':
      return {
        billing_rail: 'stripe',
        has_funds: true,
        is_active: true,
        max_seats: 1,
        occupied_seats: 1,
        scheduled_change: null,
        team_credit_stop: null
      } satisfies BillingStatusResponse
    case '/api/billing/balance':
      return {
        amount_micros: 12_500_000,
        currency: 'USD'
      } satisfies BillingBalanceResponse
    case '/api/billing/capabilities':
      return capabilitiesResponse(scope)
    case '/api/billing/topup':
      return {
        amount_cents: 1000,
        billing_op_id: 'op-1',
        status: 'completed',
        topup_id: 'topup-1'
      } satisfies CreateTopupResponse
    case '/api/billing/ops/op-1':
      return {
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date(Date.now()).toISOString()
      } satisfies BillingOpStatusResponse
    default:
      return {}
  }
}

function installIngest(features: Record<string, boolean> = {}) {
  const ingest = {
    userId: 'user-a',
    csrfToken: 'csrf-1',
    sessionDown: false,
    refusals: [] as string[],
    mintRefusal: undefined as (() => Response) | undefined,
    mintGate: undefined as Promise<void> | undefined,
    heldMints: 0,
    holdMint() {
      let release = () => {}
      ingest.mintGate = new Promise<void>((resolve) => {
        release = resolve
      })
      return release
    },
    mints: 0,
    mintedFor: [] as string[],
    requests: [] as ApiRequest[],
    currentWorkspaceDown: undefined as (() => Response) | undefined,
    billingUnauthorized: 0,
    customerMissing: false,
    capabilitiesDown: false,
    hasPersonalWorkspace: undefined as boolean | undefined
  }

  const mint = (body: unknown): Response => {
    if (ingest.mintRefusal) return ingest.mintRefusal()
    ingest.mints += 1
    ingest.mintedFor.push(mintBodyWorkspace(body))
    return jsonResponse({
      token: `session-jwt-${ingest.mints}`,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
      role: 'owner',
      permissions: []
    })
  }

  const billingWorkspace = (headers: Record<string, string>): string => {
    const minted = /^Bearer session-jwt-(\d+)$/.exec(headers.authorization)
    if (!minted) return headers['x-comfy-workspace-id'] ?? 'ws-personal'
    const workspace = ingest.mintedFor.at(Number(minted[1]) - 1) ?? 'personal'
    return workspace === 'personal' ? 'ws-personal' : workspace
  }

  const respondBilling = ({
    path,
    headers
  }: ApiRequest): Response | undefined => {
    if (path === '/customers') {
      ingest.customerMissing = false
      return jsonResponse({ id: 'customer-1' }, 201)
    }
    if (path.startsWith('/customers/') && ingest.customerMissing) {
      return jsonResponse({ message: MISSING_CUSTOMER_MESSAGE }, 409)
    }
    if (!path.startsWith('/api/billing/')) return undefined
    if (ingest.billingUnauthorized > 0) {
      ingest.billingUnauthorized -= 1
      return jsonResponse({ code: 'unauthorized', message: 'expired' }, 401)
    }
    if (path === '/api/billing/capabilities' && ingest.capabilitiesDown) {
      return jsonResponse({ code: 'unavailable', message: 'down' }, 503)
    }
    return jsonResponse(
      billingAnswer(path, {
        userId: ingest.userId,
        workspaceId: billingWorkspace(headers)
      })
    )
  }

  const answerSession = (): Response =>
    ingest.sessionDown
      ? jsonResponse({ code: 'unavailable', message: 'down' }, 503)
      : jsonResponse({
          ...sessionBody(ingest.userId, ingest.hasPersonalWorkspace),
          csrf_token: ingest.csrfToken
        })

  const respond = (request: ApiRequest, body: unknown): Response => {
    const { path, headers } = request
    if (path === '/api/auth/session') return answerSession()
    if (path === '/api/auth/token') return mint(body)
    if (path === '/api/workspaces/current') {
      if (ingest.currentWorkspaceDown) return ingest.currentWorkspaceDown()
      return currentWorkspaceResponse(headers['x-comfy-workspace-id'])
    }
    if (path === '/api/workspaces') return jsonResponse(WORKSPACE_LIST)
    if (path.startsWith('/api/global-settings')) {
      return jsonResponse(STORED_CONSENT)
    }
    const code = ingest.refusals.shift()
    if (code) return jsonResponse({ code, message: code }, 403)
    return respondBilling(request) ?? jsonResponse({})
  }

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const request = recordApiRequest(input, init)
      if (request.path === '/api/features') {
        return jsonResponse({ unified_web_session: true, ...features })
      }
      ingest.requests.push(request)
      if (request.path === '/api/auth/token' && ingest.mintGate) {
        ingest.heldMints += 1
        await ingest.mintGate
      }
      return respond(request, init?.body)
    })
  )
  return ingest
}

async function bootOnSession(features: Record<string, boolean> = {}) {
  const ingest = installIngest(features)
  await refreshRemoteConfig({ useAuth: false })
  useAuthStore()
  identity.signIn(USER_A)
  await useSessionCookie().ensureSessionCookie()
  ingest.requests.length = 0
  return ingest
}

const postPrompt = () =>
  api.fetchApi('/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  })

const sessionRequest = (
  method: string,
  path: string,
  headers: Record<string, string> = {}
): ApiRequest => ({
  method,
  path,
  headers: { 'x-comfy-client': COMFY_CLIENT, ...headers },
  credentials: 'include'
})

const LISTED = {
  role: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
} as const

const WORKSPACE_LIST = {
  workspaces: [
    { ...LISTED, id: 'ws-personal', name: 'Personal', type: 'personal' },
    { ...LISTED, id: 'ws-team', name: 'Team', type: 'team' }
  ]
}

const STORED_CONSENT = {
  key: AGENT_CONSENT_SETTING_ID,
  value: true,
  updated_at: '2026-01-01T00:00:00Z'
}

const PROMPT_HEADERS = { 'comfy-user': '', 'content-type': 'application/json' }

describe('cloud API requests on the shared web session', () => {
  beforeEach(() => {
    identity.reset()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  it('sends the session headers instead of a token, and a workspace switch changes only the header', async () => {
    const ingest = await bootOnSession()
    const workspaceAuth = useWorkspaceAuthStore()
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, 'ws-team')
    vi.spyOn(workspaceApi, 'list').mockResolvedValue({
      workspaces: [
        { ...LISTED, id: 'ws-personal', name: 'Personal', type: 'personal' },
        { ...LISTED, id: 'ws-team', name: 'Team', type: 'team' }
      ]
    })

    await useTeamWorkspaceStore().initialize()
    await api.fetchApi('/queue')
    await postPrompt()
    expect(await useAuthStore().getAuthHeader()).toEqual({
      Authorization: 'Bearer firebase-id-token'
    })
    await workspaceAuth.switchWorkspace('ws-personal')
    await api.fetchApi('/queue')

    const team = { 'x-comfy-workspace-id': 'ws-team' }
    expect(ingest.requests).toEqual([
      sessionRequest('GET', '/api/workspaces/current', team),
      sessionRequest('GET', '/api/queue', { ...team, 'comfy-user': '' }),
      sessionRequest('POST', '/api/prompt', {
        ...team,
        ...PROMPT_HEADERS,
        'x-csrf-token': 'csrf-1'
      }),
      sessionRequest('GET', '/api/workspaces/current', {
        'x-comfy-workspace-id': 'ws-personal'
      }),
      sessionRequest('GET', '/api/queue', { 'comfy-user': '' })
    ])
    expect(workspaceAuth.currentWorkspace).toEqual({
      id: 'ws-personal',
      name: 'Personal',
      type: 'personal',
      role: 'owner'
    })
  })

  it.for([
    {
      name: 'the same user is re-read once and retried once with the fresh token',
      sessionUser: 'user-a',
      sessionDown: false,
      status: 200,
      tokens: ['csrf-1', 'session', 'csrf-2', 'csrf-2']
    },
    {
      name: 'a changed user abandons the request and the tab follows the new account',
      sessionUser: 'user-b',
      sessionDown: false,
      status: 403,
      tokens: ['csrf-1', 'session', 'csrf-2']
    },
    {
      name: 'a failed re-read abandons the request',
      sessionUser: 'user-a',
      sessionDown: true,
      status: 403,
      tokens: ['csrf-1', 'session', 'csrf-1']
    }
  ])(
    'csrf_invalid: $name',
    async ({ sessionUser, sessionDown, status, tokens }) => {
      const ingest = await bootOnSession()
      ingest.refusals.push('csrf_invalid')
      ingest.userId = sessionUser
      ingest.sessionDown = sessionDown
      ingest.csrfToken = 'csrf-2'

      const response = await postPrompt()
      const signedInAfterRefusal = useCloudWebSessionStore().signedInUser?.id
      await postPrompt()

      expect(response.status).toBe(status)
      expect(signedInAfterRefusal).toBe(sessionUser)
      expect(
        ingest.requests.map(({ path, headers }) =>
          path === '/api/auth/session' ? 'session' : headers['x-csrf-token']
        )
      ).toEqual(tokens)
    }
  )

  it('workspace_access_denied drops the selection and is never replayed', async () => {
    const ingest = await bootOnSession()
    vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    const workspaceAuth = useWorkspaceAuthStore()
    await workspaceAuth.switchWorkspace('ws-team')
    ingest.requests.length = 0
    ingest.refusals.push('workspace_access_denied')

    const response = await postPrompt()
    await api.fetchApi('/queue')

    expect(response.status).toBe(403)
    expect(workspaceAuth.currentWorkspace).toBeNull()
    expect(ingest.requests).toEqual([
      sessionRequest('POST', '/api/prompt', {
        'x-comfy-workspace-id': 'ws-team',
        ...PROMPT_HEADERS,
        'x-csrf-token': 'csrf-1'
      }),
      sessionRequest('GET', '/api/queue', { 'comfy-user': '' })
    ])
  })

  it('reports a request sent on the session as authenticated', async () => {
    await bootOnSession()
    const onAuthHeader = vi.fn()

    await api.fetchApi('/queue', { onAuthHeader })

    expect(onAuthHeader).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('refuses a switch into a workspace the session cannot enter', async () => {
    await bootOnSession()
    const workspaceAuth = useWorkspaceAuthStore()

    await expect(workspaceAuth.switchWorkspace('ws-gone')).rejects.toThrow(
      '403'
    )
    expect(workspaceAuth.currentWorkspace).toBeNull()
  })

  it.for([
    {
      name: 'a 503',
      down: () => jsonResponse({ code: 'internal', message: 'down' }, 503)
    },
    {
      name: 'a network failure',
      down: () => {
        throw new TypeError('Failed to fetch')
      }
    }
  ])(
    're-entering the current workspace keeps it through $name',
    async ({ down }) => {
      const ingest = await bootOnSession()
      const workspaceAuth = useWorkspaceAuthStore()
      await workspaceAuth.switchWorkspace('ws-team')
      ingest.currentWorkspaceDown = down

      await expect(workspaceAuth.switchWorkspace('ws-team')).rejects.toThrow()
      ingest.requests.length = 0
      await api.fetchApi('/queue')

      expect(workspaceAuth.currentWorkspace?.id).toBe('ws-team')
      expect(ingest.requests).toEqual([
        sessionRequest('GET', '/api/queue', {
          'x-comfy-workspace-id': 'ws-team',
          'comfy-user': ''
        })
      ])
    }
  )
})

describe('workspace API and global settings on the shared web session', () => {
  beforeEach(() => {
    identity.reset()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  it.for<{ workspace: string; headers: Record<string, string> }>([
    { workspace: 'ws-team', headers: { 'x-comfy-workspace-id': 'ws-team' } },
    { workspace: 'ws-personal', headers: {} }
  ])(
    'reads billing status in $workspace on the session cookie',
    async ({ workspace, headers }) => {
      const ingest = await bootOnSession()
      localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, workspace)
      await useTeamWorkspaceStore().initialize()
      ingest.requests.length = 0

      await workspaceApi.getBillingStatus()

      expect(ingest.requests).toEqual([
        sessionRequest('GET', '/api/billing/status', {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          ...headers
        })
      ])
    }
  )

  it('never mints a workspace token or re-reads the workspace after initializing', async () => {
    const ingest = await bootOnSession()
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, 'ws-team')

    await useTeamWorkspaceStore().initialize()
    await workspaceApi.getBillingStatus()
    await workspaceApi.getBillingStatus()

    expect(ingest.requests.map(({ path }) => path)).toEqual([
      '/api/workspaces',
      '/api/workspaces/current',
      '/api/billing/status',
      '/api/billing/status'
    ])
  })

  it('retries a write once on csrf_invalid with the fresh token', async () => {
    const ingest = await bootOnSession()
    ingest.refusals.push('csrf_invalid')
    ingest.csrfToken = 'csrf-2'

    await workspaceApi.createTopup(500)

    expect(
      ingest.requests.map(({ path, headers }) =>
        path === '/api/auth/session' ? 'session' : headers['x-csrf-token']
      )
    ).toEqual(['csrf-1', 'session', 'csrf-2'])
    expect(ingest.requests.map(({ path }) => path)).toEqual([
      '/api/billing/topup',
      '/api/auth/session',
      '/api/billing/topup'
    ])
  })

  it('maps an error status to the same WorkspaceApiError', async () => {
    const ingest = await bootOnSession()
    ingest.refusals.push('plan_required')

    await expect(workspaceApi.getBillingStatus()).rejects.toMatchObject({
      name: 'WorkspaceApiError',
      status: 403,
      code: 'plan_required',
      message: 'plan_required'
    })
  })

  it('maps a 403 no_workspace_access on the session to NoWorkspaceAccessError', async () => {
    const ingest = await bootOnSession()
    ingest.refusals.push('no_workspace_access')

    await expect(workspaceApi.getBillingStatus()).rejects.toBeInstanceOf(
      NoWorkspaceAccessError
    )
  })

  it('returns no workspace auth header and sends nothing', async () => {
    const ingest = await bootOnSession()
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, 'ws-team')
    await useTeamWorkspaceStore().initialize()
    ingest.requests.length = 0

    expect(await useAuthStore().getWorkspaceAuthHeader()).toBeNull()
    expect(ingest.requests).toEqual([])
  })

  it('reads and writes a global setting on the session', async () => {
    const ingest = await bootOnSession()
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, 'ws-team')
    await useTeamWorkspaceStore().initialize()
    ingest.requests.length = 0
    const send = await webSessionSend()
    assert.exists(send)

    await getGlobalSetting(AGENT_CONSENT_SETTING_ID, send)
    await setGlobalSetting({ key: AGENT_CONSENT_SETTING_ID, value: true }, send)

    const team = { 'x-comfy-workspace-id': 'ws-team' }
    expect(ingest.requests).toEqual([
      sessionRequest(
        'GET',
        `/api/global-settings/${AGENT_CONSENT_SETTING_ID}`,
        team
      ),
      sessionRequest('POST', '/api/global-settings', {
        ...team,
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-1'
      })
    ])
  })
})

class FakeSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static created: FakeSocket[] = []
  readyState = FakeSocket.CONNECTING
  binaryType = 'blob'
  readonly path: string
  constructor(url: string | URL) {
    super()
    const parsed = new URL(String(url))
    this.path = parsed.pathname + parsed.search
    FakeSocket.created.push(this)
  }
  send() {}
  close() {
    this.readyState = FakeSocket.CLOSED
  }
  closeFromServer() {
    this.close()
    this.dispatchEvent(new Event('close'))
  }
}

const MEDIA_ITEM = {
  filename: 'output.png',
  subfolder: '',
  type: 'output',
  nodeId: '1',
  mediaType: 'images'
} as const

describe('live updates and media on the shared web session', () => {
  beforeEach(() => {
    identity.reset()
    firebaseSignOut.mockReset()
    firebaseSignOut.mockImplementation(async () => identity.signOut())
    FakeSocket.created = []
    vi.stubGlobal('WebSocket', FakeSocket)
    window.name = ''
    api.socket = null
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  async function bootWithSocket() {
    const ingest = await bootOnSession()
    await api.init()
    return ingest
  }

  it('opens the socket on the cookie and reconnects it into each workspace without minting a token', async () => {
    const ingest = await bootWithSocket()
    const workspaceAuth = useWorkspaceAuthStore()
    expect(FakeSocket.created.map(({ path }) => path)).toEqual(['/ws'])

    await workspaceAuth.switchWorkspace('ws-team')
    await vi.waitFor(() =>
      expect(api.socket).toEqual(
        expect.objectContaining({ path: '/ws?workspace_id=ws-team' })
      )
    )
    await workspaceAuth.switchWorkspace('ws-personal')
    await vi.waitFor(() =>
      expect(api.socket).toEqual(expect.objectContaining({ path: '/ws' }))
    )

    expect(api.socket).toBe(FakeSocket.created.at(-1))
    const replaced = FakeSocket.created.slice(0, -1)
    expect(replaced.map(({ readyState }) => readyState)).toEqual(
      replaced.map(() => FakeSocket.CLOSED)
    )
    expect(
      FakeSocket.created.filter(({ path }) => path.includes('token'))
    ).toEqual([])
    expect(ingest.requests.map(({ path }) => path)).not.toContain(
      '/api/auth/token'
    )
  })

  it.for([
    { workspace: 'ws-team', suffix: '&workspace_id=ws-team' },
    { workspace: 'ws-personal', suffix: '' }
  ])(
    'media URLs name the workspace only for a team ($workspace)',
    async ({ workspace, suffix }) => {
      await bootOnSession()
      await useWorkspaceAuthStore().switchWorkspace(workspace)

      expect([
        resultItemUrl(MEDIA_ITEM),
        resultItemVhsAdvancedPreviewUrl(MEDIA_ITEM),
        api.apiURL('/vhs/viewvideo?filename=a.mp4'),
        api.apiURL('/api/view?filename=a.png'),
        api.apiURL('/assets/asset-1/content?disposition=inline'),
        api.apiURL('/queue?view=1')
      ]).toEqual([
        `/api/view?filename=output.png&type=output&subfolder=${suffix}`,
        `/api/viewvideo?filename=output.png&type=output&subfolder=${suffix}`,
        `/api/vhs/viewvideo?filename=a.mp4${suffix}`,
        `/api/view?filename=a.png${suffix}`,
        `/api/assets/asset-1/content?disposition=inline${suffix}`,
        '/api/queue?view=1'
      ])
    }
  )

  it('a media fetch names the team workspace in the header only', async () => {
    const ingest = await bootOnSession()
    await useWorkspaceAuthStore().switchWorkspace('ws-team')
    ingest.requests.length = 0

    await api.fetchApi('/view?filename=a.png')

    const [url] = vi.mocked(fetch).mock.calls.at(-1) ?? []
    expect(String(url)).toBe('/api/view?filename=a.png')
    expect(ingest.requests).toEqual([
      sessionRequest('GET', '/api/view', {
        'x-comfy-workspace-id': 'ws-team',
        'comfy-user': ''
      })
    ])
  })

  it('a server close while signed in reconnects on the session', async () => {
    await bootWithSocket()
    await useWorkspaceAuthStore().switchWorkspace('ws-team')
    await vi.waitFor(() =>
      expect(api.socket).toEqual(
        expect.objectContaining({ path: '/ws?workspace_id=ws-team' })
      )
    )
    const closed = api.socket
    assert.instanceOf(closed, FakeSocket)

    closed.closeFromServer()
    await vi.advanceTimersByTimeAsync(300)

    await vi.waitFor(() => expect(api.socket).not.toBe(closed))
    expect(api.socket).toEqual(
      expect.objectContaining({ path: '/ws?workspace_id=ws-team' })
    )
  })

  it('sign-out closes the socket and opens no other', async () => {
    await bootWithSocket()
    const sessionSocket = api.socket
    assert.instanceOf(sessionSocket, FakeSocket)

    await useAuthStore().logout()
    expect(sessionSocket.readyState).toBe(FakeSocket.CLOSED)

    sessionSocket.closeFromServer()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(FakeSocket.created).toEqual([sessionSocket])
    expect(api.socket).toBeNull()
  })
})

describe('comfy-api calls on the shared web session', () => {
  const mintRequests = (ingest: ReturnType<typeof installIngest>) =>
    ingest.requests.filter(({ path }) => path === '/api/auth/token')

  beforeEach(() => {
    identity.reset()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  it('a tab that arrived by session mints the personal token once and reuses it', async () => {
    const ingest = installIngest()
    await refreshRemoteConfig({ useAuth: false })
    useAuthStore()
    await useSessionCookie().ensureSessionCookie()

    const first = await webSessionResourceHeader()
    const second = await webSessionResourceHeader()

    expect([first, second]).toEqual([
      { Authorization: 'Bearer session-jwt-1' },
      { Authorization: 'Bearer session-jwt-1' }
    ])
    expect(mintRequests(ingest)).toEqual([
      {
        method: 'POST',
        path: '/api/auth/token',
        headers: {
          'content-type': 'application/json',
          'x-comfy-client': COMFY_CLIENT,
          'x-csrf-token': 'csrf-1'
        },
        credentials: 'include'
      }
    ])
  })

  it('mints the personal token even while a team workspace is selected', async () => {
    const ingest = await bootOnSession()
    await useWorkspaceAuthStore().switchWorkspace('ws-team')

    await webSessionResourceHeader()

    const [mint] = mintRequests(ingest)
    expect(mint.headers).not.toHaveProperty('x-comfy-workspace-id')
  })

  it('mints nothing for pages that only call ingest', async () => {
    const ingest = await bootOnSession()
    await useWorkspaceAuthStore().switchWorkspace('ws-team')

    await api.fetchApi('/queue')
    await postPrompt()

    expect(ingest.mints).toBe(0)
  })

  it('a revoked session rejects with SESSION_REVOKED', async () => {
    const ingest = await bootOnSession()
    ingest.mintRefusal = () =>
      jsonResponse({ code: 'session_revoked', message: 'revoked' }, 401)

    await expect(webSessionResourceHeader()).rejects.toMatchObject({
      failure: { code: 'SESSION_REVOKED' }
    })
  })

  it.for([
    {
      name: 'a revoked session',
      status: 401,
      serverCode: 'session_revoked',
      failure: 'SESSION_REVOKED',
      copy: 'Your session ended. Sign in again to continue.'
    },
    {
      name: 'an expired session',
      status: 401,
      serverCode: 'session_expired',
      failure: 'SESSION_EXPIRED',
      copy: 'Your session ended. Sign in again to continue.'
    },
    {
      name: 'no session',
      status: 401,
      failure: 'NO_SESSION',
      copy: 'Your session ended. Sign in again to continue.'
    },
    {
      name: 'a stale CSRF token',
      status: 403,
      serverCode: 'csrf_invalid',
      failure: 'CSRF_STALE',
      copy: 'Your request was refused. Reload the page and try again.'
    },
    {
      name: 'a denied workspace',
      status: 403,
      serverCode: 'workspace_access_denied',
      failure: 'WORKSPACE_ACCESS_DENIED',
      copy: "You don't have access to this workspace. Contact support if this keeps happening."
    },
    {
      name: 'a missing workspace',
      status: 404,
      serverCode: 'NOT_FOUND',
      failure: 'WORKSPACE_ACCESS_DENIED',
      copy: "You don't have access to this workspace. Contact support if this keeps happening."
    },
    {
      name: 'a refused request',
      status: 403,
      failure: 'SESSION_REQUEST_REFUSED',
      copy: 'Your request was refused. Reload the page and try again.'
    },
    {
      name: 'a server error',
      status: 500,
      failure: 'SESSION_UNAVAILABLE',
      copy: "We couldn't reach your account. Try again in a moment."
    }
  ])(
    'a mint refused by $name rejects with the localized copy',
    async ({ status, serverCode, failure, copy }) => {
      const ingest = await bootOnSession()
      ingest.mintRefusal = () =>
        jsonResponse(
          serverCode ? { code: serverCode, message: 'refused' } : {},
          status
        )

      const rejection = await webSessionResourceHeader().catch(
        (error: unknown) => error
      )

      assert(rejection instanceof WebSessionTokenError)
      expect(rejection.failure.code).toBe(failure)
      expect(rejection.message).toBe(copy)
    }
  )

  it('a sign-out while the mint is in flight is not reported and says the session ended', async () => {
    firebaseSignOut.mockImplementation(async () => identity.signOut())
    const ingest = await bootOnSession()
    const release = ingest.holdMint()

    const pending = webSessionResourceHeader().catch((error: unknown) => error)
    await vi.waitFor(() => expect(ingest.heldMints).toBe(1))
    await useAuthStore().logout()
    release()
    const rejection = await pending

    assert(rejection instanceof WebSessionTokenError)
    expect(rejection.failure.code).toBe('NO_SESSION')
    expect(rejection.message).toBe(
      'Your session ended. Sign in again to continue.'
    )
    expect(reportError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorType: 'auth_session_token_mint_failure' })
    )
  })

  it('a mint failure stays a SessionTokenError and keeps the original as its cause', async () => {
    const ingest = await bootOnSession()
    ingest.mintRefusal = () => jsonResponse({}, 500)

    const rejection = await webSessionResourceHeader().catch(
      (error: unknown) => error
    )

    expect(rejection).toBeInstanceOf(SessionTokenError)
    assert(rejection instanceof WebSessionTokenError)
    expect(rejection.cause).toBeInstanceOf(SessionTokenError)
    expect(rejection.cause).not.toBeInstanceOf(WebSessionTokenError)
    expect(rejection.cause.failure).toBe(rejection.failure)
  })

  it('a sign-out that lands before the mint is not reported', async () => {
    firebaseSignOut.mockImplementation(async () => identity.signOut())
    await bootOnSession()
    const requests = webSessionRequests()
    assert(requests)
    const scope = await requests.scope()
    assert(scope)
    await useAuthStore().logout()

    const rejection = await requests
      .authorizeResource(scope)
      .catch((error: unknown) => error)

    assert(rejection instanceof WebSessionTokenError)
    expect(rejection.failure.code).toBe('NO_SESSION')
    expect(reportError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorType: 'auth_session_token_mint_failure' })
    )
  })

  it('reports the original mint error with its code and status', async () => {
    const ingest = await bootOnSession()
    ingest.mintRefusal = () => jsonResponse({}, 500)

    const rejection = await webSessionResourceHeader().catch(
      (error: unknown) => error
    )

    assert(rejection instanceof WebSessionTokenError)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(rejection.cause, {
      errorType: 'auth_session_token_mint_failure',
      level: 'warning',
      surface: 'auth',
      tags: { code: 'SESSION_UNAVAILABLE', http_status: 500 }
    })
  })

  it.for([
    {
      name: 'a 401',
      refuse: () => jsonResponse({ code: 'session_revoked' }, 401),
      reported: false
    },
    { name: 'a 403', refuse: () => jsonResponse({}, 403), reported: true },
    { name: 'a 429', refuse: () => jsonResponse({}, 429), reported: true },
    { name: 'a 500', refuse: () => jsonResponse({}, 500), reported: true },
    {
      name: 'a network failure',
      refuse: (): Response => {
        throw new TypeError('Failed to fetch')
      },
      reported: true
    }
  ])('$name mint refusal reports: $reported', async ({ refuse, reported }) => {
    const ingest = await bootOnSession()
    ingest.mintRefusal = refuse

    await webSessionResourceHeader().catch(() => undefined)

    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(reported ? 1 : 0)
  })

  it('mints again once the cached token is within a minute of expiry', async () => {
    const ingest = await bootOnSession()

    await webSessionResourceHeader()
    await vi.advanceTimersByTimeAsync(13 * 60_000)
    await webSessionResourceHeader()
    await vi.advanceTimersByTimeAsync(60_000)
    const reminted = await webSessionResourceHeader()

    expect(reminted).toEqual({ Authorization: 'Bearer session-jwt-2' })
    expect(mintRequests(ingest)).toHaveLength(2)
  })
})

describe('billing SDK rails on a tab that arrived by session', () => {
  const BILLING_SDK_RAILS = {
    unified_cloud_auth: true,
    billing_sdk_topup_enabled: true,
    billing_sdk_subscription_enabled: true
  }

  const bootSessionOnly = async (workspace = 'ws-personal') => {
    const ingest = installIngest(BILLING_SDK_RAILS)
    await refreshRemoteConfig({ useAuth: false })
    useAuthStore()
    await useSessionCookie().ensureSessionCookie()
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, workspace)
    await useTeamWorkspaceStore().initialize()
    ingest.requests.length = 0
    return ingest
  }

  const sent = (ingest: ReturnType<typeof installIngest>) =>
    ingest.requests.map(({ method, path, headers }) => ({
      method,
      path,
      authorization: headers.authorization
    }))

  const readRail = () => {
    const rail = useBillingReadRail()
    assert.exists(rail)
    return rail
  }

  beforeEach(() => {
    identity.reset()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  it.for([
    { workspace: 'ws-personal', mintedFor: 'personal' },
    { workspace: 'ws-team', mintedFor: 'ws-team' }
  ])(
    'reads billing in $workspace with a token minted from the session cookie alone',
    async ({ workspace, mintedFor }) => {
      const ingest = await bootSessionOnly(workspace)

      const capabilities = await readRail().readCapabilities({})

      assert(capabilities.status === 'ok')
      expect(capabilities.value.resolved_for).toEqual({
        user_id: 'user-a',
        workspace_id: workspace
      })
      expect(useAuthStore().currentUser).toBeNull()
      expect(ingest.mintedFor).toEqual([mintedFor])
      expect(sent(ingest)).toEqual([
        { method: 'POST', path: '/api/auth/token', authorization: undefined },
        {
          method: 'GET',
          path: '/api/billing/capabilities',
          authorization: 'Bearer session-jwt-1'
        }
      ])
    }
  )

  it('starts a top-up with the session-minted token and no Firebase login', async () => {
    const ingest = await bootSessionOnly()

    const purchase = useBillingSdkStore().createTopup(1000)
    await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.initialMs)

    await expect(purchase).resolves.toMatchObject({
      billing_op_id: 'op-1',
      status: 'completed'
    })
    expect(useAuthStore().currentUser).toBeNull()
    expect(ingest.mintedFor).toEqual(['personal'])
    expect(
      sent(ingest).filter(({ path }) => path === '/api/billing/topup')
    ).toEqual([
      {
        method: 'POST',
        path: '/api/billing/topup',
        authorization: 'Bearer session-jwt-1'
      }
    ])
    expect(
      sent(ingest).filter(
        ({ path, authorization }) =>
          path.startsWith('/api/billing/') &&
          authorization !== 'Bearer session-jwt-1'
      )
    ).toEqual([])
  })

  it('re-mints once through the session on a 401 and retries once', async () => {
    const ingest = await bootSessionOnly()
    ingest.billingUnauthorized = 1

    const status = await readRail().readStatus()

    expect(status.status).toBe('ok')
    expect(sent(ingest)).toEqual([
      { method: 'POST', path: '/api/auth/token', authorization: undefined },
      {
        method: 'GET',
        path: '/api/billing/status',
        authorization: 'Bearer session-jwt-1'
      },
      { method: 'POST', path: '/api/auth/token', authorization: undefined },
      {
        method: 'GET',
        path: '/api/billing/status',
        authorization: 'Bearer session-jwt-2'
      }
    ])
  })

  it('follows a workspace switch with a token for the new workspace', async () => {
    const ingest = await bootSessionOnly()
    const rail = readRail()

    await rail.readStatus()
    await useWorkspaceAuthStore().switchWorkspace('ws-team')
    await rail.readStatus()

    expect(ingest.mintedFor).toEqual(['personal', 'ws-team'])
    expect(
      sent(ingest)
        .filter(({ path }) => path === '/api/billing/status')
        .map(({ authorization }) => authorization)
    ).toEqual(['Bearer session-jwt-1', 'Bearer session-jwt-2'])
  })
})

describe.for([{ unified: false }, { unified: true }])(
  'the Run token on the shared web session (unified_cloud_auth $unified)',
  ({ unified }) => {
    const boot = async () => {
      const ingest = await bootOnSession({ unified_cloud_auth: unified })
      ingest.mints = 0
      ingest.mintedFor.length = 0
      return ingest
    }

    beforeEach(() => {
      identity.reset()
      firebaseSignOut.mockReset()
      firebaseSignOut.mockImplementation(async () => identity.signOut())
      vi.spyOn(api, 'resetSocket').mockResolvedValue()
    })

    afterEach(() => {
      remoteConfig.value = {}
      localStorage.clear()
    })

    it.for([
      { workspace: 'personal', expected: ['personal'] },
      { workspace: 'ws-team', expected: ['ws-team'] }
    ])(
      'mints the $workspace workspace token from the session',
      async ({ workspace, expected }) => {
        const ingest = await boot()
        if (workspace !== 'personal') {
          await useWorkspaceAuthStore().switchWorkspace(workspace)
        }

        const token = await useAuthStore().getWorkspaceAuthToken()

        expect(token).toBe('session-jwt-1')
        expect(ingest.mintedFor).toEqual(expected)
        expect(
          ingest.requests
            .filter(({ path }) => path === '/api/auth/token')
            .map(({ headers }) => headers.authorization)
        ).toEqual(expected.map(() => undefined))
      }
    )

    it('reuses one mint across Runs and re-mints once it nears expiry', async () => {
      const ingest = await boot()
      const authStore = useAuthStore()

      const first = await authStore.getWorkspaceAuthToken()
      const second = await authStore.getWorkspaceAuthToken()
      await vi.advanceTimersByTimeAsync(14 * 60_000)
      const third = await authStore.getWorkspaceAuthToken()

      expect([first, second]).toEqual(['session-jwt-1', 'session-jwt-1'])
      expect(third).not.toBe(first)
      expect(
        ingest.requests.filter(
          ({ path, headers }) =>
            path === '/api/auth/token' && !('authorization' in headers)
        )
      ).toHaveLength(2)
    })

    it('keeps each workspace token cached across a switch and back', async () => {
      const ingest = await boot()
      const authStore = useAuthStore()
      const workspaceAuth = useWorkspaceAuthStore()

      const personal = await authStore.getWorkspaceAuthToken()
      await workspaceAuth.switchWorkspace('ws-team')
      const team = await authStore.getWorkspaceAuthToken()
      await workspaceAuth.switchWorkspace('ws-personal')
      const personalAgain = await authStore.getWorkspaceAuthToken()

      expect([personal, team, personalAgain]).toEqual([
        'session-jwt-1',
        'session-jwt-2',
        'session-jwt-1'
      ])
      expect(ingest.mintedFor).toEqual(['personal', 'ws-team'])
    })

    it('resolves undefined for a revoked session and mints again once it recovers', async () => {
      const ingest = await boot()
      const authStore = useAuthStore()
      ingest.mintRefusal = () =>
        jsonResponse({ code: 'session_revoked', message: 'revoked' }, 401)

      await expect(authStore.getWorkspaceAuthToken()).resolves.toBeUndefined()

      ingest.mintRefusal = undefined
      await expect(authStore.getWorkspaceAuthToken()).resolves.toBe(
        'session-jwt-1'
      )
    })

    it('resolves undefined while rate limited and sends no mint until Retry-After passes', async () => {
      const ingest = await boot()
      const authStore = useAuthStore()
      ingest.mintRefusal = () =>
        new Response(
          JSON.stringify({ code: 'rate_limited', message: 'slow' }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
          }
        )

      await expect(authStore.getWorkspaceAuthToken()).resolves.toBeUndefined()

      ingest.mintRefusal = undefined
      await vi.advanceTimersByTimeAsync(30_000)
      await expect(authStore.getWorkspaceAuthToken()).resolves.toBeUndefined()
      expect(ingest.mints).toBe(0)

      await vi.advanceTimersByTimeAsync(30_000)
      await expect(authStore.getWorkspaceAuthToken()).resolves.toBe(
        'session-jwt-1'
      )
    })

    it.for([
      {
        name: 'a missing workspace',
        refuse: () =>
          jsonResponse({ code: 'NOT_FOUND', message: 'not found' }, 404),
        workspace: undefined
      },
      {
        name: 'a denied workspace',
        refuse: () =>
          jsonResponse({ code: 'workspace_access_denied', message: 'no' }, 403),
        workspace: undefined
      },
      {
        name: 'a server error',
        refuse: () => jsonResponse({ code: 'internal', message: 'down' }, 503),
        workspace: 'ws-team'
      }
    ])(
      'a team token refused for $name leaves the workspace $workspace',
      async ({ refuse, workspace }) => {
        const ingest = await boot()
        vi.spyOn(window.location, 'reload').mockImplementation(() => {})
        const workspaceAuth = useWorkspaceAuthStore()
        await workspaceAuth.switchWorkspace('ws-team')
        ingest.mintRefusal = refuse

        await expect(
          useAuthStore().getWorkspaceAuthToken()
        ).resolves.toBeUndefined()
        expect(workspaceAuth.currentWorkspace?.id).toBe(workspace)
      }
    )

    it('a team re-mint refused for a missing workspace drops it too', async () => {
      const ingest = await boot()
      vi.spyOn(window.location, 'reload').mockImplementation(() => {})
      const workspaceAuth = useWorkspaceAuthStore()
      await workspaceAuth.switchWorkspace('ws-team')
      const requests = webSessionRequests()
      assert.exists(requests)
      const scope = await requests.scope()
      assert.exists(scope)
      ingest.mintRefusal = () =>
        jsonResponse({ code: 'NOT_FOUND', message: 'not found' }, 404)

      const result = await requests.remintWorkspaceToken({
        ...scope,
        workspaceId: 'ws-team'
      })

      expect(result).toMatchObject({ code: 'WORKSPACE_ACCESS_DENIED' })
      expect(workspaceAuth.currentWorkspace?.id).toBeUndefined()
    })

    const switchSessionTo = async (
      ingest: ReturnType<typeof installIngest>,
      userId: string
    ) => {
      ingest.userId = userId
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
      expect(useCloudWebSessionStore().signedInUser?.id).toBe(userId)
    }

    it.for([
      { name: 'another user', switches: ['user-b'] },
      { name: 'another user and back', switches: ['user-b', 'user-a'] }
    ])(
      'a Run token whose session goes to $name while minting is not sent',
      async ({ switches }) => {
        const ingest = await boot()
        const release = ingest.holdMint()

        const pending = useAuthStore().getWorkspaceAuthToken()
        await vi.waitFor(() => expect(ingest.heldMints).toBe(1))
        for (const userId of switches) await switchSessionTo(ingest, userId)
        release()

        await expect(pending).resolves.toBeUndefined()
      }
    )

    it.for([
      {
        name: 'is signed out',
        change: () => useAuthStore().logout(),
        code: 'NO_SESSION'
      },
      {
        name: 'goes to another user',
        change: (ingest: ReturnType<typeof installIngest>) =>
          switchSessionTo(ingest, 'user-b'),
        code: 'IDENTITY_CHANGED'
      }
    ])(
      'a workspace token whose session $name while minting fails with $code',
      async ({ change, code }) => {
        const ingest = await boot()
        const requests = webSessionRequests()
        assert(requests)
        const scope = await requests.scope()
        assert(scope)
        const release = ingest.holdMint()

        const pending = requests.workspaceToken(scope)
        await vi.waitFor(() => expect(ingest.heldMints).toBe(1))
        await change(ingest)
        release()

        expect(await pending).toMatchObject({ status: 'error', code })
      }
    )

    it('a token asked for a scope another user has since taken is refused', async () => {
      const ingest = await boot()
      const requests = webSessionRequests()
      assert(requests)
      const scope = await requests.scope()
      assert(scope)
      await switchSessionTo(ingest, 'user-b')

      const result = await requests.workspaceToken(scope)

      expect(result).toMatchObject({
        status: 'error',
        code: 'IDENTITY_CHANGED'
      })
    })

    it('resolves undefined and mints nothing after sign-out', async () => {
      const ingest = await boot()
      const authStore = useAuthStore()
      await authStore.logout()

      await expect(authStore.getWorkspaceAuthToken()).resolves.toBeUndefined()
      expect(ingest.mints).toBe(0)
    })
  }
)

describe('a sibling tab under unified_cloud_auth', () => {
  const openChannels = new Set<InMemoryChannel>()

  class InMemoryChannel extends EventTarget {
    constructor(readonly name: string) {
      super()
      openChannels.add(this)
    }

    postMessage(data: unknown) {
      for (const peer of openChannels) {
        if (peer !== this && peer.name === this.name) {
          peer.dispatchEvent(new MessageEvent('message', { data }))
        }
      }
    }

    close() {
      openChannels.delete(this)
    }
  }

  const followerLocks = fromPartial<LockManager>({
    request: (_name: string, options: LockOptions) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('abandoned', 'AbortError'))
        )
      })
  })

  const publishFromSibling = () => {
    const sibling = new InMemoryChannel(
      'comfy-account-refresh:user-a:ws-personal'
    )
    sibling.postMessage({
      token: 'sibling-jwt',
      expiresAt: Date.now() + 60 * 60_000,
      uid: 'user-a',
      workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
      role: 'owner',
      permissions: []
    })
    sibling.close()
  }

  const firebaseExchanges = () =>
    vi
      .mocked(fetch)
      .mock.calls.map(([input, init]) => recordApiRequest(input, init))
      .filter(
        ({ path, headers }) =>
          path === '/api/auth/token' &&
          headers.authorization === 'Bearer firebase-id-token'
      )

  beforeEach(() => {
    identity.reset()
    openChannels.clear()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
    vi.stubGlobal('BroadcastChannel', InMemoryChannel)
    vi.spyOn(navigator, 'locks', 'get').mockReturnValue(followerLocks)
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  it('leaves a session tab on its own workspace, and its Run carries that workspace', async () => {
    const ingest = await bootOnSession({ unified_cloud_auth: true })
    const workspaceAuth = useWorkspaceAuthStore()

    await workspaceAuth.mintAtLogin()
    await workspaceAuth.switchWorkspace('ws-team')
    publishFromSibling()
    await postPrompt()

    expect(workspaceAuth.currentWorkspace?.id).toBe('ws-team')
    expect(ingest.requests.at(-1)).toEqual(
      sessionRequest('POST', '/api/prompt', {
        'x-comfy-workspace-id': 'ws-team',
        ...PROMPT_HEADERS,
        'x-csrf-token': 'csrf-1'
      })
    )
    expect(firebaseExchanges()).toEqual([])
  })

  it('still mints at login and adopts the sibling token with the web session off', async () => {
    await bootOnSession({
      unified_cloud_auth: true,
      unified_web_session: false
    })
    const workspaceAuth = useWorkspaceAuthStore()

    await expect(workspaceAuth.mintAtLogin()).resolves.toBe(true)
    publishFromSibling()

    expect(firebaseExchanges()).toHaveLength(1)
    expect(workspaceAuth.currentWorkspace?.id).toBe('ws-personal')
    expect(workspaceAuth.getUnifiedToken()).toBe('sibling-jwt')
  })
})

describe('billing on a tab that arrived by session', () => {
  const bootSessionOnly = async (
    features: Record<string, boolean> = {},
    hasPersonalWorkspace?: boolean
  ) => {
    const ingest = installIngest(features)
    ingest.hasPersonalWorkspace = hasPersonalWorkspace
    await refreshRemoteConfig({ useAuth: false })
    const authStore = useAuthStore()
    await useSessionCookie().ensureSessionCookie()
    ingest.requests.length = 0
    return { ingest, authStore }
  }

  const authorizationsOf = (ingest: ReturnType<typeof installIngest>) =>
    ingest.requests.map(({ method, path, headers }) => ({
      method,
      path,
      authorization: new Headers(headers).get('authorization')
    }))

  const SESSION_MINT = {
    method: 'POST',
    path: '/api/auth/token',
    authorization: null
  }
  const onSessionToken = (method: string, path: string) => ({
    method,
    path,
    authorization: 'Bearer session-jwt-1'
  })

  beforeEach(() => {
    identity.reset()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
    localStorage.clear()
  })

  it.for([
    {
      name: 'balance',
      call: (authStore: ReturnType<typeof useAuthStore>) =>
        authStore.fetchBalance(),
      sent: [onSessionToken('GET', '/customers/balance')]
    },
    {
      name: 'top-up',
      call: (authStore: ReturnType<typeof useAuthStore>) =>
        authStore.initiateCreditPurchase({
          amount_micros: 5_000_000,
          currency: 'usd'
        }),
      sent: [
        onSessionToken('POST', '/customers'),
        onSessionToken('POST', '/customers/credit')
      ]
    },
    {
      name: 'billing portal',
      call: (authStore: ReturnType<typeof useAuthStore>) =>
        authStore.accessBillingPortal(),
      sent: [onSessionToken('POST', '/customers/billing')]
    }
  ])(
    'the $name call is sent with the session-minted token',
    async ({ call, sent }) => {
      const { ingest, authStore } = await bootSessionOnly()

      await call(authStore)

      expect(authStore.currentUser).toBeNull()
      expect(authorizationsOf(ingest)).toEqual([SESSION_MINT, ...sent])
    }
  )

  it.for([
    { sso: false, reported: false, sendsCustomers: true },
    { sso: true, reported: undefined, sendsCustomers: true },
    { sso: true, reported: true, sendsCustomers: true },
    { sso: true, reported: false, sendsCustomers: false }
  ])(
    'sso_enabled $sso with has_personal_workspace $reported: balance reaches /customers is $sendsCustomers',
    async ({ sso, reported, sendsCustomers }) => {
      const { ingest, authStore } = await bootSessionOnly(
        { sso_enabled: sso },
        reported
      )

      await authStore.fetchBalance()

      expect(
        ingest.requests.some(({ path }) => path.startsWith('/customers'))
      ).toBe(sendsCustomers)
    }
  )

  it.for([
    {
      name: 'top-up',
      call: (authStore: ReturnType<typeof useAuthStore>) =>
        authStore.initiateCreditPurchase({
          amount_micros: 5_000_000,
          currency: 'usd'
        })
    },
    {
      name: 'billing portal',
      call: (authStore: ReturnType<typeof useAuthStore>) =>
        authStore.accessBillingPortal()
    },
    {
      name: 'subscription checkout',
      call: (authStore: ReturnType<typeof useAuthStore>) =>
        authStore.fetchWithCustomerRecovery(
          '/customers/cloud-subscription-checkout',
          { method: 'POST' }
        )
    }
  ])(
    'the $name call is refused before /customers without a personal workspace',
    async ({ call }) => {
      const { ingest, authStore } = await bootSessionOnly(
        { sso_enabled: true },
        false
      )

      await expect(call(authStore)).rejects.toMatchObject({
        code: NO_PERSONAL_WORKSPACE
      })
      expect(
        ingest.requests.filter(({ path }) => path.startsWith('/customers'))
      ).toEqual([])
    }
  )

  it('loads no customer events without a personal workspace', async () => {
    const { ingest } = await bootSessionOnly({ sso_enabled: true }, false)
    const events = useCustomerEventsService()

    await expect(events.getMyEvents()).resolves.toBeNull()
    expect(events.error.value).toBe(
      'This account has no personal billing. Manage billing from your team workspace.'
    )
    expect(
      ingest.requests.filter(({ path }) => path.startsWith('/customers'))
    ).toEqual([])
  })

  it('provisions a missing customer on the session token and retries once', async () => {
    const { ingest, authStore } = await bootSessionOnly()
    ingest.customerMissing = true

    await authStore.fetchBalance()

    expect(authorizationsOf(ingest)).toEqual([
      SESSION_MINT,
      onSessionToken('GET', '/customers/balance'),
      onSessionToken('POST', '/customers'),
      onSessionToken('GET', '/customers/balance')
    ])
  })

  it.for([
    { name: 'resolves', capabilitiesDown: false, authoritative: true },
    {
      name: 'is unavailable, falling back to the owner',
      capabilitiesDown: true,
      authoritative: false
    }
  ])(
    'billing capabilities for the session user: the read $name',
    async ({ capabilitiesDown, authoritative }, { onTestFinished }) => {
      const { ingest } = await bootSessionOnly()
      ingest.capabilitiesDown = capabilitiesDown
      localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, 'ws-team')
      await useTeamWorkspaceStore().initialize()
      const scope = effectScope()
      onTestFinished(() => scope.stop())
      const capabilities = scope.run(() => useBillingCapabilities())
      assert.exists(capabilities)

      await capabilities.initialize()

      expect({
        isReady: capabilities.isReady.value,
        canTopUp: capabilities.canTopUp.value,
        authoritative: capabilities.snapshotAuthoritative.value
      }).toEqual({ isReady: true, canTopUp: true, authoritative })
    }
  )
})

describe.for([{ unified: false }, { unified: true }])(
  'a tab that arrived on the session with no Firebase login (unified_cloud_auth $unified)',
  ({ unified }) => {
    const bootSessionOnly = async (
      session: ServerSession = { userId: 'user-a' }
    ) => {
      const server = installServer(session, { unified_cloud_auth: unified })
      await refreshRemoteConfig({ useAuth: false })
      const authStore = useAuthStore()
      const webSession = useCloudWebSessionStore()
      expect(webSession.start()).toBe(true)
      await webSession.whenReady()
      server.requests.length = 0
      return { server, authStore }
    }

    beforeEach(() => {
      identity.reset()
      firebaseSignOut.mockReset()
      firebaseSignOut.mockImplementation(async () => identity.signOut())
      vi.spyOn(api, 'resetSocket').mockResolvedValue()
    })

    afterEach(() => {
      remoteConfig.value = {}
    })

    it('takes its identity from the session', async () => {
      const { authStore } = await bootSessionOnly()
      const user = useCurrentUser()

      expect(authStore.currentUser).toBeNull()
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.userId).toBe('user-a')
      expect(authStore.userEmail).toBe('user-a@example.com')
      expect(authStore.currentUserIdentity()).toBe('user-a')
      expect(user.isLoggedIn.value).toBe(true)
      expect(user.isApiKeyLogin.value).toBe(false)
      expect(user.resolvedUserInfo.value).toEqual({ id: 'user-a' })
      expect(user.userEmail.value).toBe('user-a@example.com')
      expect(user.providerName.value).toBe('Google')
      expect(user.providerIcon.value).toBe('pi pi-google')
    })

    it('is signed out until the session says otherwise', async () => {
      const { authStore } = await bootSessionOnly('none')

      expect(authStore.isAuthenticated).toBe(false)
      expect(useCurrentUser().isLoggedIn.value).toBe(false)
      expect(useCurrentUser().resolvedUserInfo.value).toBeNull()
    })

    it('prefers the session over a different Firebase user', async () => {
      firebaseSignOut.mockResolvedValue()
      const server = installServer(
        { userId: 'user-a' },
        { unified_cloud_auth: unified }
      )
      await refreshRemoteConfig({ useAuth: false })
      const authStore = useAuthStore()
      identity.signIn(USER_B)
      const webSession = useCloudWebSessionStore()
      webSession.start()
      await webSession.whenReady()
      const user = useCurrentUser()

      expect(server.requests.map(({ method }) => method)).toEqual(['GET'])
      expect(authStore.userId).toBe('user-a')
      expect(authStore.userEmail).toBe('user-a@example.com')
      expect(authStore.currentUserIdentity()).toBe('user-a')
      expect(user.resolvedUserInfo.value).toEqual({ id: 'user-a' })
      expect(user.userEmail.value).toBe('user-a@example.com')
      expect(user.userDisplayName.value).toBeUndefined()
      expect(user.userPhotoUrl.value).toBeUndefined()
      expect(user.isEmailProvider.value).toBe(false)
    })

    it('discards a late balance response after the Firebase credential changes', async () => {
      const { authStore } = await bootSessionOnly()
      identity.signIn(USER_A)
      const sessionFetch = fetch
      let signalBalanceRequested: () => void = () => {}
      const balanceRequested = new Promise<void>((resolve) => {
        signalBalanceRequested = resolve
      })
      let resolveBalance: (value: unknown) => void = () => {}
      const balance = new Promise((resolve) => {
        resolveBalance = resolve
      })
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (input, init) => {
          const url = new URL(String(input), location.href)
          if (url.pathname === '/api/auth/token') {
            return jsonResponse({
              token: 'session-jwt-1',
              expires_at: new Date(Date.now() + TEN_MINUTES_MS).toISOString(),
              workspace: {
                id: 'ws-personal',
                name: 'Personal',
                type: 'personal'
              },
              role: 'owner',
              permissions: []
            })
          }
          if (url.pathname === '/customers/balance') {
            signalBalanceRequested()
            return fromPartial<Response>({ ok: true, json: () => balance })
          }
          return sessionFetch(input, init)
        })
      )

      const pending = authStore.fetchBalance()
      await balanceRequested
      identity.signIn(USER_B)
      resolveBalance({ balance: 4242 })

      await expect(pending).resolves.toBeNull()
      expect(authStore.balance).toBeNull()
    })

    it('signs out on the session alone', async () => {
      const { server, authStore } = await bootSessionOnly()

      await authStore.logout()

      expect(server.requests).toEqual([
        { method: 'DELETE', authorization: null, credentials: 'include' }
      ])
      expect(firebaseSignOut).not.toHaveBeenCalled()
      expect(useCurrentUser().isLoggedIn.value).toBe(false)
      expect(authStore.isAuthenticated).toBe(false)
    })
  }
)

describe.for([{ unified: false }, { unified: true }])(
  'booting the cloud identity from the session (unified_cloud_auth $unified)',
  ({ unified }) => {
    const install = async (session: ServerSession) => {
      const server = installServer(session, { unified_cloud_auth: unified })
      await refreshRemoteConfig({ useAuth: false })
      const authStore = useAuthStore()
      return { server, authStore }
    }
    const methodsOfServer = (server: ReturnType<typeof installServer>) =>
      methodsOf(server.requests)

    beforeEach(() => {
      identity.reset()
      firebaseSignOut.mockReset()
      firebaseSignOut.mockImplementation(async () => identity.signOut())
      vi.spyOn(api, 'resetSocket').mockResolvedValue()
    })

    afterEach(() => {
      remoteConfig.value = {}
    })

    it('signs in on the session alone', async () => {
      const { server, authStore } = await install({ userId: 'user-a' })
      identity.resolve(null)

      await expect(cloudSignIn()).resolves.toBe('signed_in')

      expect(methodsOfServer(server)).toEqual(['GET'])
      expect(authStore.userId).toBe('user-a')
      expect(useCurrentUser().resolvedUserInfo.value).toEqual({ id: 'user-a' })
      expect(firebaseSignOut).not.toHaveBeenCalled()
    })

    it('boots once however many callers ask', async () => {
      const { server } = await install({ userId: 'user-a' })
      identity.resolve(null)

      await Promise.all([bootCloudIdentity(), cloudSignIn(), cloudSignIn()])

      expect(methodsOfServer(server)).toEqual(['GET'])
    })

    it.for([
      {
        name: 'a remembered login',
        remembered: USER_A,
        signOutTakesEffect: true,
        signOuts: 1
      },
      {
        name: 'a remembered login that outlives the local sign-out',
        remembered: USER_A,
        signOutTakesEffect: false,
        signOuts: 1
      },
      {
        name: 'no remembered login',
        remembered: null,
        signOutTakesEffect: true,
        signOuts: 0
      }
    ])(
      'a revoked session is signed out with $name',
      async ({ remembered, signOutTakesEffect, signOuts }) => {
        const { server } = await install('revoked')
        if (!signOutTakesEffect) firebaseSignOut.mockResolvedValue()
        identity.resolve(remembered)

        await expect(cloudSignIn()).resolves.toBe('signed_out')

        expect(methodsOfServer(server)).toEqual(['GET'])
        expect(firebaseSignOut).toHaveBeenCalledTimes(signOuts)
      }
    )

    it('stays pending through an outage without signing anyone out, then signs in', async () => {
      const { server } = await install('network')
      identity.resolve(null)

      await expect(cloudSignIn()).resolves.toBe('pending')
      let decided: string | undefined
      void useCloudWebSessionStore()
        .whenDecided()
        .then((outcome) => (decided = outcome))
      await vi.advanceTimersByTimeAsync(3_000)

      expect(decided).toBeUndefined()
      expect(new Set(methodsOfServer(server))).toEqual(new Set(['GET']))
      expect(firebaseSignOut).not.toHaveBeenCalled()

      server.session = { userId: 'user-a' }
      await vi.advanceTimersByTimeAsync(60_000)

      expect(decided).toBe('signed_in')
      await expect(cloudSignIn()).resolves.toBe('signed_in')
    })

    it('does not decide until the login of a different user is gone', async () => {
      const { authStore } = await install({ userId: 'user-a' })
      firebaseSignOut.mockImplementation(
        () =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              identity.signOut()
              resolve()
            }, 1_000)
          )
      )
      identity.resolve(USER_B)
      let outcome: string | undefined
      void cloudSignIn().then((result) => (outcome = result))

      await vi.advanceTimersByTimeAsync(500)
      expect(outcome).toBeUndefined()
      expect(authStore.currentUser).toEqual(USER_B)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(outcome).toBe('signed_in')
      expect(authStore.currentUser).toBeNull()
      expect(authStore.userId).toBe('user-a')
    })

    it.for([
      {
        name: 'the credentialed read turns an anonymous false on',
        answers: { probe: true, anonymous: false, credentialed: true },
        enabled: true,
        reads: 2
      },
      {
        name: 'a credentialed read that comes back false (untrusted origin) stays off',
        answers: { probe: true, anonymous: false, credentialed: false },
        enabled: false,
        reads: 2
      },
      {
        name: 'no probe means the one anonymous read and nothing else',
        answers: { probe: false, anonymous: false, credentialed: true },
        enabled: false,
        reads: 1
      }
    ])('unified_web_session: $name', async ({ answers, enabled, reads }) => {
      const server = installServer(
        { userId: 'user-a' },
        { unified_cloud_auth: unified },
        answers
      )
      await refreshRemoteConfig({ useAuth: false })
      useAuthStore()
      identity.resolve(null)

      await expect(cloudSignIn()).resolves.toBe(
        enabled ? 'signed_in' : 'signed_out'
      )

      expect(useFeatureFlags().flags.unifiedWebSessionEnabled).toBe(enabled)
      expect(server.featureReads).toHaveLength(reads)
      expect(server.featureReads.slice(1)).toEqual(
        reads === 2 ? [{ credentials: 'include', client: COMFY_CLIENT }] : []
      )
      expect(server.featureReads[0].client).toBeNull()
      expect(methodsOfServer(server)).toEqual(enabled ? ['GET'] : [])
    })

    it('holds a request while the session read is retrying, then sends it on the session', async () => {
      const { server } = await install('network')
      identity.resolve(null)
      await cloudSignIn()
      const queueReads = () =>
        vi
          .mocked(fetch)
          .mock.calls.filter(
            ([input]) =>
              new URL(String(input), location.href).pathname === '/api/queue'
          )

      const response = api.fetchApi('/queue')
      await vi.advanceTimersByTimeAsync(3_000)
      expect(queueReads()).toEqual([])

      server.session = { userId: 'user-a' }
      await vi.advanceTimersByTimeAsync(60_000)
      await response
      expect(queueReads().map(([, init]) => init?.credentials)).toEqual([
        'include'
      ])
    })

    it('reports reconnecting only after ten seconds of failed reads, and never signs out', async () => {
      const { server } = await install('network')
      identity.resolve(null)
      await cloudSignIn()
      const webSession = useCloudWebSessionStore()

      await vi.advanceTimersByTimeAsync(9_000)
      expect(webSession.reconnecting).toBe(false)

      await vi.advanceTimersByTimeAsync(2_000)
      expect(webSession.reconnecting).toBe(true)
      expect(methodsOfServer(server)).not.toContain('DELETE')
      expect(firebaseSignOut).not.toHaveBeenCalled()

      server.session = { userId: 'user-a' }
      await vi.advanceTimersByTimeAsync(60_000)
      expect(webSession.reconnecting).toBe(false)
    })

    it('a restore refused as a revoked token signs the remembered login out', async () => {
      const { server } = await install('restore_token_revoked')
      identity.resolve(USER_A)

      await expect(cloudSignIn()).resolves.toBe('signed_out')

      expect(methodsOfServer(server)).toEqual(['GET', 'POST'])
      expect(firebaseSignOut).toHaveBeenCalledOnce()
    })

    describe('the router', () => {
      afterEach(() => {
        clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.DESKTOP_LOGIN)
      })

      const enterApp = async () => {
        await router.push('/cloud/login')
        await router.push('/user-select')
        return router.currentRoute.value.path
      }

      it('sends a revoked session to login, and a fresh sign-in there gets into the app without looping', async () => {
        await install('revoked')
        identity.resolve(null)
        await expect(enterApp()).resolves.toBe('/cloud/login')

        await useAuthStore().login('user-a@example.com', 'password')

        await router.push('/user-select')
        expect(router.currentRoute.value.path).toBe('/user-select')
      })

      it('waits for a slow session creation after a fresh sign-in instead of bouncing to login', async () => {
        await install('revoked')
        identity.resolve(null)
        await expect(enterApp()).resolves.toBe('/cloud/login')
        const fetchNow = fetch
        vi.stubGlobal(
          'fetch',
          async (input: RequestInfo | URL, init?: RequestInit) => {
            if (
              init?.method === 'POST' &&
              String(input).includes('/auth/session')
            ) {
              await new Promise((resolve) => setTimeout(resolve, 500))
            }
            return fetchNow(input, init)
          }
        )

        await useAuthStore().login('user-a@example.com', 'password')
        const navigation = router.push('/user-select')
        await vi.advanceTimersByTimeAsync(2_000)
        await navigation

        expect(router.currentRoute.value.path).toBe('/user-select')
      })

      it('lets the reload after that sign-in into the app', async () => {
        const { server } = await install('revoked')
        markInteractiveSignIn('user-a')
        const reloaded = createDisposablePinia()
        setActivePinia(reloaded.pinia)
        useAuthStore()
        identity.resolve(USER_A)

        await expect(enterApp()).resolves.toBe('/user-select')

        expect(methodsOfServer(server).filter((m) => m === 'POST')).toEqual([
          'POST'
        ])
        reloaded[Symbol.dispose]()
      })

      it('lets a public route through while the session read never answers', async () => {
        await install({ userId: 'user-a' })
        identity.resolve(null)
        const fetchNow = fetch
        vi.stubGlobal(
          'fetch',
          (input: RequestInfo | URL, init?: RequestInit) =>
            String(input).includes('/auth/session')
              ? new Promise<Response>(() => {})
              : fetchNow(input, init)
        )

        const navigation = router.push('/cloud/forgot-password')
        await vi.advanceTimersByTimeAsync(5_000)
        await navigation

        expect(router.currentRoute.value.path).toBe('/cloud/forgot-password')
      })

      it('lets a session-only tab in without a login page', async () => {
        await install({ userId: 'user-a' })
        identity.resolve(null)

        await expect(enterApp()).resolves.toBe('/user-select')
      })

      it('sends a session-only tab holding a desktop login code to sign in, not into the app', async () => {
        await install({ userId: 'user-a' })
        identity.resolve(null)
        await router.push('/cloud/login')

        await router.push(
          `/user-select?desktop_login_code=dlc_${'A'.repeat(43)}`
        )

        expect(router.currentRoute.value.path).toBe('/cloud/login')
        expect(router.currentRoute.value.query.switchAccount).toBeDefined()
      })

      it('sends a revoked session to the login page', async () => {
        await install('revoked')
        identity.resolve(null)

        await expect(enterApp()).resolves.toBe('/cloud/login')
      })

      describe('once the tab is in the app', () => {
        const stopRecording: (() => void)[] = []

        afterEach(() => {
          stopRecording.splice(0).forEach((stop) => stop())
        })

        const enterAppRecordingNavigations = async () => {
          const { server } = await install({ userId: 'user-a' })
          identity.resolve(null)
          await expect(enterApp()).resolves.toBe('/user-select')
          const started: string[] = []
          const landings: string[] = []
          stopRecording.push(
            router.beforeEach((to) => {
              started.push(to.path)
            }),
            router.afterEach((to) => {
              landings.push(to.path)
            })
          )
          return { server, started, landings }
        }

        it.for<{ name: string; session: ServerSession }>([
          { name: 'its heartbeat reads session_revoked', session: 'revoked' },
          {
            name: 'its heartbeat finds no session and no login to restore',
            session: 'none'
          }
        ])(
          'sends the tab to the login page once, keeping its path, when $name',
          async ({ session }) => {
            const { server, landings } = await enterAppRecordingNavigations()

            server.session = session
            await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
            await vi.waitFor(() => expect(landings).toEqual(['/cloud/login']))
            await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)

            expect(landings).toEqual(['/cloud/login'])
            expect(router.currentRoute.value.query.previousFullPath).toBe(
              encodeURIComponent('/user-select')
            )
          }
        )

        it('leaves the navigation of a sign-out in this tab to the sign-out flow', async () => {
          const { started } = await enterAppRecordingNavigations()

          await useAuthStore().logout()
          await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)

          expect(started).toEqual([])
        })
      })

      it('waits out an outage instead of sending the tab to the login page', async () => {
        const { server } = await install('network')
        identity.resolve(null)
        await router.push('/cloud/login')

        let path: string | undefined
        void router.push('/user-select').then(() => {
          path = router.currentRoute.value.path
        })
        await vi.advanceTimersByTimeAsync(3_000)
        expect(path).toBeUndefined()

        server.session = { userId: 'user-a' }
        await vi.advanceTimersByTimeAsync(60_000)
        expect(path).toBe('/user-select')
      })
    })
  }
)

describe.for([{ unified: false }, { unified: true }])(
  'signing in again after a sign-out (unified_cloud_auth $unified)',
  ({ unified }) => {
    const pages: Disposable[] = []
    const methodsSince = (server: ReturnType<typeof installServer>) =>
      methodsOf(server.requests)

    const startPage = async (user: User | null) => {
      const page = createDisposablePinia()
      pages.push(page)
      setActivePinia(page.pinia)
      useAuthStore()
      identity.resolve(user)
      const webSession = useCloudWebSessionStore()
      webSession.start()
      await webSession.whenReady()
      return webSession
    }

    const signInThenReload = async () => {
      const server = installServer('revoked', { unified_cloud_auth: unified })
      await refreshRemoteConfig({ useAuth: false })
      await startPage(null)
      server.dropPosts = true
      await useAuthStore().login('user-a@example.com', 'password')
      await vi.advanceTimersByTimeAsync(0)
      server.dropPosts = false
      server.requests.length = 0
      firebaseSignOut.mockClear()
      return server
    }

    beforeEach(() => {
      identity.reset()
      sessionStorage.clear()
      firebaseSignOut.mockReset()
      firebaseSignOut.mockImplementation(async () => identity.signOut())
      vi.spyOn(api, 'resetSocket').mockResolvedValue()
    })

    afterEach(() => {
      pages.splice(0).forEach((page) => page[Symbol.dispose]())
      remoteConfig.value = {}
    })

    it('creates the session once on the reload after an interactive sign-in, then signs in', async () => {
      const server = await signInThenReload()

      await startPage(USER_A)

      expect(methodsSince(server)).toEqual(['POST', 'GET', 'GET'])
      expect(server.requests[0].authorization).toBe('Bearer firebase-id-token')
      expect(await webSessionSend()).toBeDefined()
      expect(firebaseSignOut).not.toHaveBeenCalled()
    })

    it('consumes the marker on the first boot', async () => {
      const server = await signInThenReload()
      await startPage(USER_A)
      server.session = 'revoked'
      server.requests.length = 0
      firebaseSignOut.mockClear()

      await startPage(USER_A)

      expect(methodsSince(server)).toEqual(['GET'])
      expect(firebaseSignOut).toHaveBeenCalledOnce()
    })

    it.for([
      {
        name: 'no marker: a genuine remote sign-out',
        mark: () => {},
        waitMs: 0
      },
      {
        name: 'a marker for another user',
        mark: () => markInteractiveSignIn('user-b'),
        waitMs: 0
      },
      {
        name: 'an expired marker',
        mark: () => markInteractiveSignIn('user-a'),
        waitMs: 3 * 60_000
      }
    ])(
      'treats a revoked session as remote with $name',
      async ({ mark, waitMs }) => {
        const server = installServer('revoked', { unified_cloud_auth: unified })
        await refreshRemoteConfig({ useAuth: false })
        mark()
        await vi.advanceTimersByTimeAsync(waitMs)

        await startPage(USER_A)

        expect(methodsSince(server)).toEqual(['GET'])
        expect(await webSessionSend()).toBeUndefined()
        expect(firebaseSignOut).toHaveBeenCalledOnce()
      }
    )

    it('keeps the marker when a pending sign-in fails to create the session, so the next load retries', async () => {
      const server = installServer('revoked', { unified_cloud_auth: unified })
      await refreshRemoteConfig({ useAuth: false })
      const page = createDisposablePinia()
      pages.push(page)
      setActivePinia(page.pinia)
      useAuthStore()
      server.dropPosts = true
      await useAuthStore().login('user-a@example.com', 'password')
      const webSession = useCloudWebSessionStore()
      webSession.start()
      await webSession.whenReady()
      server.dropPosts = false
      await refreshRemoteConfig({ useAuth: false })
      server.requests.length = 0

      await startPage(USER_A)

      expect(methodsSince(server)).toEqual(['POST', 'GET', 'GET'])
    })

    it('carries a sign-in made while the flag read false to the reload where it reads true', async () => {
      const features = {
        unified_web_session: false,
        unified_cloud_auth: unified
      }
      const server = installServer('revoked', features)
      await refreshRemoteConfig({ useAuth: false })
      const loginPage = createDisposablePinia()
      pages.push(loginPage)
      setActivePinia(loginPage.pinia)
      await useAuthStore().login('user-a@example.com', 'password')
      features.unified_web_session = true
      await refreshRemoteConfig({ useAuth: false })
      server.requests.length = 0

      await startPage(USER_A)

      expect(methodsSince(server)).toEqual(['POST', 'GET', 'GET'])
      expect(await webSessionSend()).toBeDefined()
    })

    it('rejects a marker stamped in the future', () => {
      markInteractiveSignIn('user-a')
      vi.setSystemTime(Date.now() - 60_000)

      expect(takeInteractiveSignIn('user-a')).toBe(false)
    })

    it('reads a marker back only once', () => {
      markInteractiveSignIn('user-a')

      expect([
        takeInteractiveSignIn('user-a'),
        takeInteractiveSignIn('user-a')
      ]).toEqual([true, false])
    })
  }
)

describe('an SSO account with no Firebase login (sso_enabled)', () => {
  const STALE_API_KEY = 'stale-api-key'

  const install = async (
    session: ServerSession,
    { sso, apiKey }: { sso: boolean; apiKey: boolean }
  ) => {
    const server = installServer(session, { sso_enabled: sso })
    await refreshRemoteConfig({ useAuth: false })
    if (apiKey) localStorage.setItem('comfy_api_key', STALE_API_KEY)
    const authStore = useAuthStore()
    identity.resolve(null)
    return { server, authStore }
  }

  beforeEach(() => {
    identity.reset()
    firebaseSignOut.mockReset()
    firebaseSignOut.mockImplementation(async () => identity.signOut())
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
  })

  it.for<{
    name: string
    sso: boolean
    session: ServerSession
    sessionReads: string[]
    onSession: boolean
    sessionOnlyUserId: string | undefined
  }>([
    {
      name: 'SSO on: a signed-in session wins over the key',
      sso: true,
      session: { userId: 'user-a' },
      sessionReads: ['GET', 'GET'],
      onSession: true,
      sessionOnlyUserId: 'user-a'
    },
    {
      name: 'SSO on: no session falls back to the key',
      sso: true,
      session: 'none',
      sessionReads: ['GET'],
      onSession: false,
      sessionOnlyUserId: undefined
    },
    {
      name: 'SSO on: a revoked session falls back to the key',
      sso: true,
      session: 'revoked',
      sessionReads: ['GET'],
      onSession: false,
      sessionOnlyUserId: undefined
    },
    {
      name: 'SSO off: the key wins without reading the session',
      sso: false,
      session: { userId: 'user-a' },
      sessionReads: [],
      onSession: false,
      sessionOnlyUserId: undefined
    }
  ])(
    'boot with a stored API key: $name',
    async ({ sso, session, sessionReads, onSession, sessionOnlyUserId }) => {
      const { server, authStore } = await install(session, {
        sso,
        apiKey: true
      })

      await expect(cloudSignIn()).resolves.toBe('signed_in')

      expect(methodsOf(server.requests)).toEqual(sessionReads)
      expect(useCloudWebSessionStore().isActive()).toBe(onSession)
      expect(authStore.sessionOnlyUser?.id).toBe(sessionOnlyUserId)
      expect(useCurrentUser().isApiKeyLogin.value).toBe(!onSession)
    }
  )

  it.for([
    { name: 'a stored API key', apiKey: true },
    { name: 'no stored API key', apiKey: false }
  ])(
    'SSO on: a session-only tab with $name enters the app as the session user',
    async ({ apiKey }) => {
      const { authStore } = await install(
        { userId: 'user-a' },
        { sso: true, apiKey }
      )
      await router.push('/cloud/login')

      await router.push('/user-select')

      expect(router.currentRoute.value.path).toBe('/user-select')
      expect(authStore.sessionOnlyUser?.id).toBe('user-a')
      expect(authStore.userId).toBe('user-a')
      expect(useCurrentUser().isApiKeyLogin.value).toBe(false)
    }
  )

  it.for([
    { sso: true, sessionOnlyUserId: 'user-a' },
    { sso: false, sessionOnlyUserId: undefined }
  ])(
    'the session user is the session-only identity only with SSO on ($sso)',
    async ({ sso, sessionOnlyUserId }) => {
      const { authStore } = await install(
        { userId: 'user-a' },
        { sso, apiKey: false }
      )
      await bootCloudIdentity()

      expect(authStore.sessionOnlyUser?.id).toBe(sessionOnlyUserId)

      identity.signIn(USER_A)
      expect(authStore.sessionOnlyUser).toBeUndefined()
    }
  )

  describe('the onboarding survey', () => {
    const bootSessionOnlyTab = async (sso: boolean) => {
      const { server } = await install(
        { userId: 'user-a' },
        { sso, apiKey: false }
      )
      await bootCloudIdentity()
      return server
    }

    it.for([
      { sso: true, status: 'stored' },
      { sso: false, status: 'failed' }
    ])(
      'is stored for the session user only with SSO on ($sso)',
      async ({ sso, status }) => {
        await bootSessionOnlyTab(sso)
        const observers = identity.userObservers.size

        const submission = submitSurvey({ q1: 'a' }, 'user-a')
        expect(identity.userObservers.size).toBe(observers + 1)
        identity.resolve(null)

        await expect(submission).resolves.toMatchObject({ status })
      }
    )

    it('is not stored once the session moves to another account', async () => {
      const server = await bootSessionOnlyTab(true)
      const fetchNow = fetch
      let releaseSettings: () => void = () => {}
      vi.stubGlobal(
        'fetch',
        async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input).includes('/settings')) {
            await new Promise<void>((resolve) => (releaseSettings = resolve))
          }
          return fetchNow(input, init)
        }
      )

      const submission = submitSurvey({ q1: 'a' }, 'user-a')
      server.session = { userId: 'user-b' }
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
      releaseSettings()

      await expect(submission).resolves.toMatchObject({ status: 'failed' })
    })
  })
})
