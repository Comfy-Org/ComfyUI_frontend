import { fromPartial } from '@total-typescript/shoehorn'
import type { User, UserCredential } from 'firebase/auth'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { ExchangeTokenResponse } from '@comfyorg/ingest-types'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { TOKEN_REFRESH_BUFFER_MS } from '@/platform/workspace/workspaceConstants'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import {
  resultItemPreviewUrl,
  resultItemUrl,
  resultItemVhsAdvancedPreviewUrl
} from '@/utils/resultItemUrl'
import type { useExtensionService } from '@/services/extensionService'
import type { ComfyApp } from '@/scripts/app'
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
      identity.signIn(FIREBASE_USER)
      return fromPartial<UserCredential>({ user: FIREBASE_USER })
    }
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

const ONE_HOUR_MS = 60 * 60 * 1000

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
  let pending: RecordedRequest[] = []
  let socketCloses = 0
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
    if (request.path === `${getComfyApiBaseUrl()}/customers`) {
      return jsonResponse({ id: 'customer-1' }, 201)
    }
    switch (`${request.method} ${request.path}`) {
      case 'GET /api/features':
        return jsonResponse(features)
      case 'POST /api/auth/session':
        return jsonResponse({ success: true })
      case 'POST /api/auth/token':
        return jsonResponse(mintResponse())
      case 'GET /api/queue':
        return jsonResponse({ queue_running: [], queue_pending: [] })
      case 'POST /api/prompt':
        return jsonResponse({ prompt_id: 'prompt-1', number: 1 })
      default:
        return jsonResponse({ message: 'unexpected request' }, 404)
    }
  }

  class RecordingWebSocket extends EventTarget {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    readyState = RecordingWebSocket.CONNECTING
    binaryType = 'blob'
    constructor(url: string | URL) {
      super()
      const parsed = new URL(String(url))
      const request: RecordedRequest = {
        method: 'WEBSOCKET',
        path: parsed.pathname + parsed.search,
        headers: {},
        credentials: null
      }
      all.push(request)
      pending.push(request)
    }
    send() {}
    close() {
      socketCloses += 1
      this.readyState = RecordingWebSocket.CLOSED
    }
  }
  vi.stubGlobal('WebSocket', RecordingWebSocket)

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const request = recordRequest(input, init)
      all.push(request)
      pending.push(request)
      return respond(request)
    })
  )

  return {
    all,
    get pending() {
      return pending
    },
    get socketCloses() {
      return socketCloses
    },
    take() {
      const taken = pending
      pending = []
      return taken
    }
  }
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

const FEATURES_BOOTSTRAP: RecordedRequest[] = [
  { method: 'GET', path: '/api/features', headers: {}, credentials: null }
]

const SESSION_POST: RecordedRequest = {
  method: 'POST',
  path: '/api/auth/session',
  headers: {
    authorization: 'Bearer firebase-id-token',
    'content-type': 'application/json'
  },
  credentials: 'include'
}

const TOKEN_MINT: RecordedRequest = {
  method: 'POST',
  path: '/api/auth/token',
  headers: {
    authorization: 'Bearer firebase-id-token',
    'content-type': 'application/json'
  },
  credentials: null
}

const MEDIA_ITEM = {
  filename: 'output.png',
  subfolder: '',
  type: 'output',
  nodeId: '1',
  mediaType: 'images'
} as const

const MEDIA_URLS = [
  '/api/view?filename=output.png&type=output&subfolder=',
  '/api/view?filename=output.png&type=output&subfolder=&res=512',
  '/api/viewvideo?filename=output.png&type=output&subfolder=',
  '/api/vhs/viewaudio?filename=a.wav',
  '/api/assets/asset-1/content?disposition=inline'
]

const SIGN_OUT: RecordedRequest[] = [
  {
    method: 'DELETE',
    path: '/api/auth/session',
    headers: {},
    credentials: 'include'
  },
  { method: 'WEBSOCKET', path: '/ws', headers: {}, credentials: null }
]

const CUSTOMER_PROVISIONING: RecordedRequest = {
  method: 'POST',
  path: `${getComfyApiBaseUrl()}/customers`,
  headers: {
    authorization: 'Bearer firebase-id-token',
    'content-type': 'application/json'
  },
  credentials: null
}

interface FlowGolden {
  signIn: RecordedRequest[]
  tokenRefresh: RecordedRequest[]
  apiCall: RecordedRequest[]
  socket: RecordedRequest[]
  signOut: RecordedRequest[]
}

const UNIFIED_CLOUD_AUTH_OFF: FlowGolden = {
  signIn: [SESSION_POST, CUSTOMER_PROVISIONING],
  tokenRefresh: [SESSION_POST],
  apiCall: [
    {
      method: 'GET',
      path: '/api/queue',
      headers: { authorization: 'Bearer firebase-id-token', 'comfy-user': '' },
      credentials: null
    },
    {
      method: 'POST',
      path: '/api/prompt',
      headers: {
        authorization: 'Bearer firebase-id-token',
        'comfy-user': '',
        'content-type': 'application/json'
      },
      credentials: null
    }
  ],
  socket: [
    {
      method: 'WEBSOCKET',
      path: '/ws?token=firebase-id-token',
      headers: {},
      credentials: null
    }
  ],
  signOut: SIGN_OUT
}

const UNIFIED_CLOUD_AUTH_ON: FlowGolden = {
  signIn: [TOKEN_MINT, SESSION_POST, CUSTOMER_PROVISIONING],
  tokenRefresh: [TOKEN_MINT, SESSION_POST],
  apiCall: [
    {
      method: 'GET',
      path: '/api/queue',
      headers: { authorization: 'Bearer cloud-jwt-2', 'comfy-user': '' },
      credentials: null
    },
    {
      method: 'POST',
      path: '/api/prompt',
      headers: {
        authorization: 'Bearer cloud-jwt-2',
        'comfy-user': '',
        'content-type': 'application/json'
      },
      credentials: null
    }
  ],
  socket: [
    {
      method: 'WEBSOCKET',
      path: '/ws?token=cloud-jwt-2',
      headers: {},
      credentials: null
    }
  ],
  signOut: SIGN_OUT
}

const FORBIDDEN_HEADERS = [
  'x-comfy-workspace-id',
  'x-csrf-token',
  'x-comfy-client'
]

const isSessionMutation = ({ method, path }: RecordedRequest) =>
  path === '/api/auth/session' && (method === 'POST' || method === 'DELETE')

describe('cloud auth requests with unified_web_session off', () => {
  let hooks: ReturnType<typeof effectScope> | undefined

  beforeEach(() => {
    identity.reset()
  })

  afterEach(() => {
    hooks?.stop()
    hooks = undefined
    remoteConfig.value = {}
  })

  it.for([
    {
      name: 'unified_cloud_auth off, unified_web_session absent',
      features: { unified_cloud_auth: false },
      golden: UNIFIED_CLOUD_AUTH_OFF
    },
    {
      name: 'unified_cloud_auth off, unified_web_session false',
      features: { unified_cloud_auth: false, unified_web_session: false },
      golden: UNIFIED_CLOUD_AUTH_OFF
    },
    {
      name: 'unified_cloud_auth on, unified_web_session absent',
      features: { unified_cloud_auth: true },
      golden: UNIFIED_CLOUD_AUTH_ON
    },
    {
      name: 'unified_cloud_auth on, unified_web_session false',
      features: { unified_cloud_auth: true, unified_web_session: false },
      golden: UNIFIED_CLOUD_AUTH_ON
    }
  ])(
    'pins sign-in, refresh, API, socket, media and sign-out traffic ($name)',
    async ({ features, golden }) => {
      const recorder = installFetchRecorder(features)

      await refreshRemoteConfig({ useAuth: false })
      expect(recorder.take()).toEqual(FEATURES_BOOTSTRAP)

      hooks = wireSessionCookieExtension()
      await useAuthStore().login('user-a@example.com', 'password')
      await vi.waitFor(() => expect(recorder.pending).toEqual(golden.signIn))
      recorder.take()

      identity.refreshIdToken()
      await vi.advanceTimersByTimeAsync(ONE_HOUR_MS - TOKEN_REFRESH_BUFFER_MS)
      await vi.waitFor(() =>
        expect(recorder.pending).toEqual(golden.tokenRefresh)
      )
      recorder.take()

      await api.fetchApi('/queue')
      await api.fetchApi('/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: {} })
      })
      expect(recorder.take()).toEqual(golden.apiCall)

      await api.resetSocket()
      expect(recorder.take()).toEqual(golden.socket)

      expect([
        resultItemUrl(MEDIA_ITEM),
        resultItemPreviewUrl(MEDIA_ITEM),
        resultItemVhsAdvancedPreviewUrl(MEDIA_ITEM),
        api.apiURL('/vhs/viewaudio?filename=a.wav'),
        api.apiURL('/assets/asset-1/content?disposition=inline')
      ]).toEqual(MEDIA_URLS)

      expect(recorder.socketCloses).toBe(0)
      identity.signOut()
      await vi.advanceTimersByTimeAsync(1_000)
      expect(recorder.take()).toEqual(golden.signOut)
      expect(recorder.socketCloses).toBe(1)

      expect(recorder.all).toEqual([
        ...FEATURES_BOOTSTRAP,
        ...golden.signIn,
        ...golden.tokenRefresh,
        ...golden.apiCall,
        ...golden.socket,
        ...golden.signOut
      ])

      expect(
        recorder.all.flatMap(({ headers }) =>
          Object.keys(headers).filter((key) => FORBIDDEN_HEADERS.includes(key))
        )
      ).toEqual([])
      expect(
        recorder.all.filter(
          (request) =>
            request.credentials === 'include' && !isSessionMutation(request)
        )
      ).toEqual([])
      expect(
        recorder.all.filter(
          ({ method, path }) => method === 'GET' && path === '/api/auth/session'
        )
      ).toEqual([])
    }
  )
})
