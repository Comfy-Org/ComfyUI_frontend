import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ExchangeTokenResponse } from '@comfyorg/ingest-types'
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { installDesktopLoginRedemption } from '@/platform/cloud/onboarding/desktopLoginRedemption'
import * as distributionTypes from '@/platform/distribution/types'
import { capturePreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import type { useDialogService } from '@/services/dialogService'
import type { useExtensionService } from '@/services/extensionService'
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
    resolveSignedOut() {
      state.user = null
      userObservers.forEach((observer) => observer(null))
    },
    refreshIdToken() {
      tokenObservers.forEach((observer) => observer(state.user))
    }
  }
})

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
    currentUser: () => identity.state.user
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

vi.mock(import('@/services/dialogService'), () => ({
  useDialogService: () =>
    fromPartial<ReturnType<typeof useDialogService>>({
      confirm: async () => true,
      showErrorDialog: () => {}
    })
}))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

await import('@/extensions/core/cloudSessionCookie')

const ONE_HOUR_MS = 60 * 60 * 1000
const API_KEY = 'comfyui-test-api-key'

const FIREBASE_USER = fromPartial<User>({
  uid: 'user-a',
  getIdToken: async () => 'firebase-id-token'
})

interface RecordedRequest {
  method: string
  path: string
  headers: Record<string, string>
  credentials: RequestCredentials | null
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function recordRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): RecordedRequest {
  const url = new URL(requestUrl(input), location.href)
  return {
    method: (init?.method ?? 'GET').toUpperCase(),
    path: url.origin === location.origin ? url.pathname + url.search : url.href,
    headers: Object.fromEntries(
      [...new Headers(init?.headers).entries()].map(([key, value]) => [
        key.toLowerCase(),
        value
      ])
    ),
    credentials: init?.credentials ?? null
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function installFetchRecorder(features: Record<string, unknown>) {
  const all: RecordedRequest[] = []
  let mintCount = 0

  const mintResponse = (): ExchangeTokenResponse => {
    mintCount += 1
    return {
      token: `cloud-jwt-${mintCount}`,
      expires_at: new Date(Date.now() + ONE_HOUR_MS).toISOString(),
      workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
      role: 'owner',
      permissions: ['owner:*']
    }
  }

  const respond = (request: RecordedRequest): Response => {
    if (request.method === 'POST' && request.path.endsWith('/customers')) {
      return jsonResponse({ id: 'customer-1' }, 201)
    }
    switch (`${request.method} ${request.path}`) {
      case 'GET /api/features':
        return jsonResponse(features)
      case 'POST /api/auth/session':
        return jsonResponse({ success: true })
      case 'POST /api/auth/token':
        return jsonResponse(mintResponse())
      case 'POST /api/auth/desktop-login-codes/redeem':
        return jsonResponse({ status: 'redeemed' })
      case 'GET /api/queue':
        return jsonResponse({ queue_running: [], queue_pending: [] })
      case 'POST /api/prompt':
        return jsonResponse({ prompt_id: 'prompt-1', number: 1 })
      default:
        return jsonResponse({ message: 'unexpected request' }, 404)
    }
  }

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const request = recordRequest(input, init)
      all.push(request)
      return respond(request)
    })
  )

  return { all }
}

function wireSessionCookieExtension() {
  const extension = registeredExtensions.find(
    ({ name }) => name === 'Comfy.Cloud.SessionCookie'
  )
  assert.exists(extension)
  const scope = effectScope()
  scope.run(() => {
    const { onUserResolved, onTokenRefreshed } = useCurrentUser()
    onUserResolved(
      (user) =>
        void extension.onAuthUserResolved?.(user, fromPartial<ComfyApp>({}))
    )
    onTokenRefreshed(() => void extension.onAuthTokenRefreshed?.())
  })
  return scope
}

async function sendApiCalls() {
  await api.fetchApi('/queue')
  await api.fetchApi('/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: {} })
  })
}

const FEATURE_ROWS = [
  { name: 'unified_cloud_auth off, unified_web_session absent', uca: false },
  {
    name: 'unified_cloud_auth off, unified_web_session false',
    uca: false,
    uws: false
  },
  { name: 'unified_cloud_auth on, unified_web_session absent', uca: true },
  {
    name: 'unified_cloud_auth on, unified_web_session false',
    uca: true,
    uws: false
  }
]

function featuresFor(row: { uca: boolean; uws?: boolean }) {
  return {
    unified_cloud_auth: row.uca,
    ...(row.uws === undefined ? {} : { unified_web_session: row.uws })
  }
}

const FEATURES_BOOTSTRAP: RecordedRequest = {
  method: 'GET',
  path: '/api/features',
  headers: {},
  credentials: null
}

const API_KEY_HEADER = { 'x-api-key': API_KEY }

const apiCalls = (auth: Record<string, string>): RecordedRequest[] => [
  {
    method: 'GET',
    path: '/api/queue',
    headers: { ...auth, 'comfy-user': '' },
    credentials: null
  },
  {
    method: 'POST',
    path: '/api/prompt',
    headers: { ...auth, 'comfy-user': '', 'content-type': 'application/json' },
    credentials: null
  }
]

const apiKeyGolden = (uca: boolean): RecordedRequest[] => [
  FEATURES_BOOTSTRAP,
  {
    method: 'POST',
    path: `${getComfyApiBaseUrl()}/customers`,
    headers: { ...API_KEY_HEADER, 'content-type': 'application/json' },
    credentials: null
  },
  ...apiCalls(uca ? {} : API_KEY_HEADER)
]

const LOCALHOST_GOLDEN: RecordedRequest[] = [
  FEATURES_BOOTSTRAP,
  ...apiCalls({})
]

const DESKTOP_REDEEM: RecordedRequest[] = [
  {
    method: 'POST',
    path: '/api/auth/desktop-login-codes/redeem',
    headers: {
      authorization: 'Bearer firebase-id-token',
      'content-type': 'application/json'
    },
    credentials: null
  }
]

const SESSION_HEADERS = [
  'x-comfy-workspace-id',
  'x-csrf-token',
  'x-comfy-client'
]

function expectNoSessionTraffic(requests: RecordedRequest[]) {
  expect(
    requests.filter(
      ({ path, credentials, headers }) =>
        path.startsWith('/api/auth/session') ||
        credentials === 'include' ||
        Object.keys(headers).some((key) => SESSION_HEADERS.includes(key))
    )
  ).toEqual([])
}

describe('clients the web session leaves on tokens', () => {
  let hooks: ReturnType<typeof effectScope> | undefined

  beforeEach(() => {
    identity.reset()
    vi.mocked(distributionTypes).isCloud = true
  })

  afterEach(() => {
    hooks?.stop()
    hooks = undefined
    remoteConfig.value = {}
  })

  it.for(FEATURE_ROWS)(
    "an API-key identity on cloud keeps today's headers and never touches a session ($name)",
    async (row) => {
      localStorage.setItem('comfy_api_key', API_KEY)
      const recorder = installFetchRecorder(featuresFor(row))
      await refreshRemoteConfig({ useAuth: false })
      hooks = wireSessionCookieExtension()
      identity.resolveSignedOut()

      await sendApiCalls()
      await vi.advanceTimersByTimeAsync(0)

      expect(recorder.all).toEqual(apiKeyGolden(row.uca))
      expectNoSessionTraffic(recorder.all)
    }
  )

  it.for(FEATURE_ROWS)(
    'a localhost frontend signs in, refreshes and calls the API with no session or cloud credential ($name)',
    async (row) => {
      vi.mocked(distributionTypes).isCloud = false
      const recorder = installFetchRecorder(featuresFor(row))
      await refreshRemoteConfig({ useAuth: false })
      hooks = wireSessionCookieExtension()

      identity.signIn(FIREBASE_USER)
      identity.refreshIdToken()
      await vi.advanceTimersByTimeAsync(ONE_HOUR_MS)
      await sendApiCalls()

      expect(recorder.all).toEqual(LOCALHOST_GOLDEN)
      expectNoSessionTraffic(recorder.all)
    }
  )

  it.for(FEATURE_ROWS)(
    'Desktop login approval redeems with the Firebase bearer token and no cookie ($name)',
    async (row) => {
      const recorder = installFetchRecorder(featuresFor(row))
      await refreshRemoteConfig({ useAuth: false })
      hooks = wireSessionCookieExtension()
      identity.signIn(FIREBASE_USER)
      await vi.advanceTimersByTimeAsync(0)
      recorder.all.length = 0

      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/:pathMatch(.*)*', component: { template: '<div />' } }
        ]
      })
      installDesktopLoginRedemption(router)
      capturePreservedQuery(
        'desktop_login',
        {
          desktop_login_code: `dlc_${row.name.replace(/\W/g, '_').padEnd(43, 'A')}`
        },
        ['desktop_login_code']
      )
      await router.push('/trigger')
      await vi.advanceTimersByTimeAsync(0)

      expect(recorder.all).toEqual(DESKTOP_REDEEM)
      expectNoSessionTraffic(recorder.all)
    }
  )
})
