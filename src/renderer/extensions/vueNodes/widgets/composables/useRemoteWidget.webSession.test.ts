import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { COMFY_CLIENT } from '@comfyorg/account-core/requestAuth'

import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useRemoteWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

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
    }
  }
})

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

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/telemetry/reportError'))

const USER = fromPartial<User>({
  uid: 'user-a',
  getIdToken: async () => 'firebase-id-token'
})

interface IngestRequest {
  method: string
  path: string
  headers: Record<string, string>
  credentials: RequestCredentials | null
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const sessionBody = () => ({
  user: { id: 'user-a', email: 'user-a@example.com', email_verified: true },
  csrf_token: 'csrf-1',
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  absolute_expires_at: new Date(Date.now() + 604_800_000).toISOString(),
  has_personal_workspace: true
})

const workspaceBody = (id: string | null) => ({
  id: id ?? 'ws-personal',
  name: id === 'ws-team' ? 'Team' : 'Personal',
  type: id === 'ws-team' ? 'team' : 'personal',
  role: 'owner',
  auth_method: 'web_session',
  permissions: ['owner:*']
})

const recordRequest = (path: string, init: RequestInit | undefined) => ({
  method: (init?.method ?? 'GET').toUpperCase(),
  path,
  headers: Object.fromEntries(
    [...new Headers(init?.headers).entries()].map(([name, value]) => [
      name.toLowerCase(),
      value
    ])
  ),
  credentials: init?.credentials ?? null
})

const RESPONSES: Record<string, (workspaceId: string | null) => unknown> = {
  '/api/features': () => ({ unified_web_session: true }),
  '/api/auth/session': sessionBody,
  '/api/workspaces/current': workspaceBody
}

function installIngest() {
  const requests: IngestRequest[] = []
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const path = new URL(String(input), location.href).pathname
    if (path !== '/api/features') requests.push(recordRequest(path, init))
    const workspaceId = new Headers(init?.headers).get('x-comfy-workspace-id')
    const body = RESPONSES[path]?.(workspaceId) ?? ['checkpoint.safetensors']
    return jsonResponse(body)
  })
  return requests
}

const workspaceHeader = (workspace: string): Record<string, string> =>
  workspace === 'ws-team' ? { 'x-comfy-workspace-id': workspace } : {}

const sessionRequest = (path: string, workspace: string): IngestRequest => ({
  method: 'GET',
  path,
  headers: { 'x-comfy-client': COMFY_CLIENT, ...workspaceHeader(workspace) },
  credentials: 'include'
})

describe('remote widgets on the shared web session', () => {
  beforeEach(() => {
    identity.reset()
    vi.spyOn(api, 'resetSocket').mockResolvedValue()
  })

  afterEach(() => {
    remoteConfig.value = {}
  })

  it.for([
    { workspace: 'ws-team', other: 'ws-personal' },
    { workspace: 'ws-personal', other: 'ws-team' }
  ])(
    'fetches in $workspace on the session and follows a switch without a token',
    async ({ workspace, other }) => {
      const requests = installIngest()
      await refreshRemoteConfig({ useAuth: false })
      useAuthStore()
      identity.signIn(USER)
      await useSessionCookie().ensureSessionCookie()
      const workspaceAuth = useWorkspaceAuthStore()
      await workspaceAuth.switchWorkspace(workspace)
      requests.length = 0

      const route = `/api/models/${workspace}`
      const widget = fromPartial<IWidget>({ name: 'model', value: '' })
      const hook = useRemoteWidget({
        remoteConfig: { route, timeout: 1000 },
        defaultValue: 'loading',
        node: createMockLGraphNode({
          addWidget: vi.fn(),
          onRemoved: undefined
        }),
        widget
      })

      await hook.waitForInventory()
      expect(requests).toEqual([sessionRequest(route, workspace)])
      expect(hook.getCachedValue()).toEqual(['checkpoint.safetensors'])

      await workspaceAuth.switchWorkspace(other)
      requests.length = 0
      widget.refresh?.()
      await hook.waitForInventory()

      expect(requests).toEqual([sessionRequest(route, other)])
    }
  )
})
