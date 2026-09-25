import { fromPartial } from '@total-typescript/shoehorn'
import type { User, UserCredential } from 'firebase/auth'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { COMFY_CLIENT } from '@comfyorg/account-core/requestAuth'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import type { useExtensionService } from '@/services/extensionService'
import { useAuthStore } from '@/stores/authStore'
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

function installIngest() {
  const ingest = {
    userId: 'user-a',
    csrfToken: 'csrf-1',
    refusals: [] as string[],
    requests: [] as ApiRequest[]
  }

  const respond = ({ path, headers }: ApiRequest): Response => {
    if (path === '/api/auth/session') {
      return jsonResponse({
        ...sessionBody(ingest.userId),
        csrf_token: ingest.csrfToken
      })
    }
    if (path === '/api/workspaces/current') {
      return currentWorkspaceResponse(headers['x-comfy-workspace-id'])
    }
    const code = ingest.refusals.shift()
    return code ? jsonResponse({ code, message: code }, 403) : jsonResponse({})
  }

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const request = recordApiRequest(input, init)
      if (request.path === '/api/features') {
        return jsonResponse({ unified_web_session: true })
      }
      ingest.requests.push(request)
      return respond(request)
    })
  )
  return ingest
}

async function bootOnSession() {
  const ingest = installIngest()
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
      status: 200,
      tokens: ['csrf-1', 'session', 'csrf-2', 'csrf-2']
    },
    {
      name: 'a changed user abandons the request',
      sessionUser: 'user-b',
      status: 403,
      tokens: ['csrf-1', 'session', 'csrf-1']
    }
  ])('csrf_invalid: $name', async ({ sessionUser, status, tokens }) => {
    const ingest = await bootOnSession()
    ingest.refusals.push('csrf_invalid')
    ingest.userId = sessionUser
    ingest.csrfToken = 'csrf-2'

    const response = await postPrompt()
    await postPrompt()

    expect(response.status).toBe(status)
    expect(
      ingest.requests.map(({ path, headers }) =>
        path === '/api/auth/session' ? 'session' : headers['x-csrf-token']
      )
    ).toEqual(tokens)
  })

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

  it('refuses a switch into a workspace the session cannot enter', async () => {
    await bootOnSession()
    const workspaceAuth = useWorkspaceAuthStore()

    await expect(workspaceAuth.switchWorkspace('ws-gone')).rejects.toThrow(
      '403'
    )
    expect(workspaceAuth.currentWorkspace).toBeNull()
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
    sessionSocket.closeFromServer()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(sessionSocket.readyState).toBe(FakeSocket.CLOSED)
    expect(FakeSocket.created).toEqual([sessionSocket])
    expect(api.socket).toBeNull()
  })
})
