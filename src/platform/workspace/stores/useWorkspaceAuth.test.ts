import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { fromPartial } from '@total-typescript/shoehorn'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
import { SSO_REQUIRED_DIALOG_KEY } from '@/platform/auth/sso/ssoRequiredDialogKey'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToast } from '@/components/ui/toast/toastStore'
import { toToastId } from '@/types/toastId'
import type { User } from 'firebase/auth'

import { storeToRefs } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import type {
  WebSessionRequestScope,
  WebSessionRequests
} from '@/platform/auth/session/webSessionFetch'
import { provideWebSessionRequests } from '@/platform/auth/session/webSessionFetch'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'

import {
  UNIFIED_IDENTITY_SETTLE_TIMEOUT_MS,
  useWorkspaceAuthStore,
  WorkspaceAuthError
} from '@/platform/workspace/stores/workspaceAuthStore'

import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'
import {
  TOKEN_REFRESH_BUFFER_MS,
  WORKSPACE_STORAGE_KEYS
} from '@/platform/workspace/workspaceConstants'
import {
  replayIdentityPort,
  stubFirebaseAuthHarness
} from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })

/**
 * Stands in for Firebase behind the store's identity entry: assigning
 * `value` moves the store's user AND fires the port, the way a real
 * auth-state event reaches both; `deliver` fires the port alone.
 */
const portUser = (user: { uid: string } | null): User | null =>
  user &&
  ({
    ...user,
    getIdToken: () => useAuthStore().getIdToken()
  } as Partial<User> as User)
const port = replayIdentityPort(() => portUser(useAuthStore().currentUser))
const portListeners = port.observers
const mockCurrentUser = {
  listeners: portListeners,
  get value(): { uid: string } | null {
    return useAuthStore().currentUser
  },
  set value(user: { uid: string } | null) {
    Object.assign(useAuthStore(), { currentUser: user })
    port.emit(portUser(user))
  },
  deliver(user: { uid: string } | null) {
    port.emit(portUser(user))
  }
}

const mockEnsureSessionCookie = vi.fn()

const mockPrepareWorkflowWorkspaceTransition = vi.hoisted(() => vi.fn())
const mockReload = vi.fn()
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@/platform/workflow/persistence/base/storageIO'), () => ({
  prepareWorkflowWorkspaceTransition: mockPrepareWorkflowWorkspaceTransition
}))

vi.mock<unknown>(import('@/platform/auth/session/useSessionCookie'), () => ({
  useSessionCookie: () => ({
    ensureSessionCookie: mockEnsureSessionCookie
  })
}))

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/platform/workspace/api/workspaceApiUrl'), () => ({
  workspaceApiUrl: (route: string) => `https://api.example.com/api${route}`
}))

vi.mock(import('@/i18n'))

vi.mock(import('@/composables/useFeatureFlags'))

const TOKEN_URL = 'https://api.example.com/api/auth/token'

const mockWorkspace = {
  id: 'workspace-123',
  name: 'Test Workspace',
  type: 'team' as const
}

const mockWorkspaceWithRole = {
  ...mockWorkspace,
  role: 'owner' as const
}

const mockTokenResponse = {
  token: 'workspace-token-abc',
  expires_at: new Date('2024-06-15T13:00:00Z').toISOString(),
  workspace: mockWorkspace,
  role: 'owner' as const,
  permissions: ['owner:*']
}

function expectedExpiresAtMs(expiresAt: string): string {
  return new Date(expiresAt).getTime().toString()
}

beforeEach(() => {
  vi.mocked(t).mockImplementation((key: unknown, params?: unknown) => {
    const error =
      params && typeof params === 'object' && 'error' in params
        ? params.error
        : undefined
    return error ? `${String(key)}: ${String(error)}` : String(key)
  })
  stubFirebaseAuthHarness()

  vi.mocked(useToast().error).mockImplementation(() => toToastId(0))
})

describe('useWorkspaceAuthStore', () => {
  beforeEach(() => {
    portListeners.clear()
    // authStore subscribes at construction; only the session client's later
    // subscription goes through the fake port.
    useAuthStore()
    vi.spyOn(firebaseIdentity, 'onUserChanged').mockImplementation(
      port.register
    )
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue(undefined)
    vi.mocked(useAuthStore().notifyTokenRefreshed).mockImplementation(() => {})
    vi.mocked(
      useTeamWorkspaceStore().forgetRevokedActiveWorkspace
    ).mockReturnValue(false)
    mockDistributionTypes.isCloud = true
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    vi.stubGlobal('location', {
      reload: mockReload,
      origin: 'http://localhost'
    })
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockCurrentUser.listeners.clear()
    mockCurrentUser.value = { uid: 'user-a' }
    mockEnsureSessionCookie.mockResolvedValue(undefined)
  })

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const store = useWorkspaceAuthStore()
      const {
        currentWorkspace,
        workspaceToken,
        isAuthenticated,
        isLoading,
        error
      } = storeToRefs(store)

      expect(currentWorkspace.value).toBeNull()
      expect(workspaceToken.value).toBeNull()
      expect(isAuthenticated.value).toBe(false)
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
    })
  })

  describe('initializeFromSession', () => {
    it('returns true and populates state when valid session data exists', () => {
      const futureExpiry = Date.now() + 3600 * 1000
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(mockWorkspaceWithRole)
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, 'valid-token')
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        futureExpiry.toString()
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.OWNER_UID, 'user-a')

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      const result = store.initializeFromSession()

      expect(result).toBe(true)
      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('valid-token')
    })

    it('rejects session data owned by a different user', () => {
      const futureExpiry = Date.now() + 3600 * 1000
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(mockWorkspaceWithRole)
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, 'user-a-token')
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        futureExpiry.toString()
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.OWNER_UID, 'user-a')
      mockCurrentUser.value = { uid: 'user-b' }

      const store = useWorkspaceAuthStore()

      expect(store.initializeFromSession()).toBe(false)
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.OWNER_UID)
      ).toBeNull()
    })

    it('returns false when sessionStorage is empty', () => {
      const store = useWorkspaceAuthStore()

      const result = store.initializeFromSession()

      expect(result).toBe(false)
    })

    it('rejects legacy session data without an owner uid', () => {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(mockWorkspaceWithRole)
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, 'legacy-token')
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        (Date.now() + 3600 * 1000).toString()
      )

      const store = useWorkspaceAuthStore()

      expect(store.initializeFromSession()).toBe(false)
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
    })

    it('returns false and clears storage when token is expired', () => {
      const pastExpiry = Date.now() - 1000
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(mockWorkspaceWithRole)
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, 'expired-token')
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        pastExpiry.toString()
      )

      const store = useWorkspaceAuthStore()

      const result = store.initializeFromSession()

      expect(result).toBe(false)
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)
      ).toBeNull()
    })

    it('returns false and clears storage when data is malformed', () => {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        'invalid-json{'
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, 'some-token')
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT, 'not-a-number')

      const store = useWorkspaceAuthStore()

      const result = store.initializeFromSession()

      expect(result).toBe(false)
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)
      ).toBeNull()
    })

    it('returns false when partial session data exists (missing token)', () => {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(mockWorkspaceWithRole)
      )
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        (Date.now() + 3600 * 1000).toString()
      )

      const store = useWorkspaceAuthStore()

      const result = store.initializeFromSession()

      expect(result).toBe(false)
    })
  })

  describe('switchWorkspace', () => {
    it('successfully exchanges Firebase token for workspace token', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, isAuthenticated } =
        storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('workspace-token-abc')
      expect(isAuthenticated.value).toBe(true)
    })

    it('waits for the matching session cookie before exchanging a workspace token', async () => {
      let confirmSession: () => void = () => {}
      mockEnsureSessionCookie.mockReturnValue(
        new Promise<void>((resolve) => {
          confirmSession = resolve
        })
      )
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const switchPromise = store.switchWorkspace('workspace-123')
      await Promise.resolve()

      expect(fetch).not.toHaveBeenCalled()

      confirmSession()
      await switchPromise

      expect(fetch).toHaveBeenCalledOnce()
      expect(store.workspaceToken).toBe('workspace-token-abc')
    })

    it('does not exchange a workspace token when session creation fails', async () => {
      mockEnsureSessionCookie.mockRejectedValue(new Error('session denied'))

      const store = useWorkspaceAuthStore()

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        'session denied'
      )
      expect(fetch).not.toHaveBeenCalled()
      expect(store.workspaceToken).toBeNull()
    })

    it('discards a token exchange that resolves after the user changes', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-token-a')
      let resolveResponse: (value: Response) => void = () => {}
      vi.mocked(fetch).mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        })
      )

      const store = useWorkspaceAuthStore()
      const switchPromise = store.switchWorkspace('workspace-123')
      mockCurrentUser.value = { uid: 'user-b' }
      resolveResponse(Response.json(mockTokenResponse))

      await switchPromise

      expect(store.workspaceToken).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
    })

    it('stores workspace data in sessionStorage', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-123')

      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBe(JSON.stringify(mockWorkspaceWithRole))
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'workspace-token-abc'
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)).toBe(
        expectedExpiresAtMs(mockTokenResponse.expires_at)
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.OWNER_UID)).toBe(
        'user-a'
      )
    })

    it('replaces the workspace token when the same user switches workspaces', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            token: 'workspace-a-token',
            workspace: { ...mockWorkspace, id: 'workspace-a' }
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            token: 'workspace-b-token',
            workspace: { ...mockWorkspace, id: 'workspace-b' }
          })
        )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-a')
      await store.switchWorkspace('workspace-b')

      expect(fetchRequests(TOKEN_URL).map(({ body }) => body)).toEqual([
        JSON.stringify({ workspace_id: 'workspace-a' }),
        JSON.stringify({ workspace_id: 'workspace-b' })
      ])
      expect(store.currentWorkspace?.id).toBe('workspace-b')
      expect(store.getWorkspaceAuthHeader()).toEqual({
        Authorization: 'Bearer workspace-b-token'
      })
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'workspace-b-token'
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.OWNER_UID)).toBe(
        'user-a'
      )
    })

    it('sets isLoading to true during operation', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      let resolveResponse: (value: Response) => void
      const responsePromise = new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
      vi.mocked(fetch).mockReturnValue(responsePromise)

      const store = useWorkspaceAuthStore()
      const { isLoading } = storeToRefs(store)

      const switchPromise = store.switchWorkspace('workspace-123')
      expect(isLoading.value).toBe(true)

      resolveResponse!(Response.json(mockTokenResponse))
      await switchPromise

      expect(isLoading.value).toBe(false)
    })

    it('keeps isLoading true until overlapping switches settle', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      let resolveFirstSwitch: (value: Response) => void = () => {}
      let resolveSecondSwitch: (value: Response) => void = () => {}
      const firstSwitchResponse = new Promise<Response>((resolve) => {
        resolveFirstSwitch = resolve
      })
      const secondSwitchResponse = new Promise<Response>((resolve) => {
        resolveSecondSwitch = resolve
      })
      vi.mocked(fetch)
        .mockReturnValueOnce(firstSwitchResponse)
        .mockReturnValueOnce(secondSwitchResponse)

      const store = useWorkspaceAuthStore()
      const { isLoading } = storeToRefs(store)

      const firstSwitch = store.switchWorkspace('workspace-123')
      const secondSwitch = store.switchWorkspace('workspace-other')

      expect(isLoading.value).toBe(true)

      resolveFirstSwitch(Response.json(mockTokenResponse))
      await firstSwitch

      expect(isLoading.value).toBe(true)

      resolveSecondSwitch(
        Response.json({
          ...mockTokenResponse,
          workspace: { ...mockWorkspace, id: 'workspace-other' }
        })
      )
      await secondSwitch

      expect(isLoading.value).toBe(false)
    })

    it('throws WorkspaceAuthError with code NOT_AUTHENTICATED when Firebase token unavailable', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(undefined)

      const store = useWorkspaceAuthStore()
      const { error } = storeToRefs(store)

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        WorkspaceAuthError
      )

      expect(error.value).toBeInstanceOf(WorkspaceAuthError)
      expect((error.value as WorkspaceAuthError).code).toBe('NOT_AUTHENTICATED')
    })

    it('throws WorkspaceAuthError with code ACCESS_DENIED on 403 response', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(
        async () =>
          new Response(JSON.stringify({ message: 'Access denied' }), {
            status: 403,
            statusText: 'Forbidden'
          })
      )

      const store = useWorkspaceAuthStore()
      const { error } = storeToRefs(store)

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        WorkspaceAuthError
      )

      expect(error.value).toBeInstanceOf(WorkspaceAuthError)
      expect((error.value as WorkspaceAuthError).code).toBe('ACCESS_DENIED')
    })

    it('throws WorkspaceAuthError with code WORKSPACE_NOT_FOUND on 404 response', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(
        async () =>
          new Response(JSON.stringify({ message: 'Workspace not found' }), {
            status: 404,
            statusText: 'Not Found'
          })
      )

      const store = useWorkspaceAuthStore()
      const { error } = storeToRefs(store)

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        WorkspaceAuthError
      )

      expect(error.value).toBeInstanceOf(WorkspaceAuthError)
      expect((error.value as WorkspaceAuthError).code).toBe(
        'WORKSPACE_NOT_FOUND'
      )
    })

    it('throws WorkspaceAuthError with code INVALID_FIREBASE_TOKEN on 401 response', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(
        async () =>
          new Response(JSON.stringify({ message: 'Invalid token' }), {
            status: 401,
            statusText: 'Unauthorized'
          })
      )

      const store = useWorkspaceAuthStore()
      const { error } = storeToRefs(store)

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        WorkspaceAuthError
      )

      expect(error.value).toBeInstanceOf(WorkspaceAuthError)
      expect((error.value as WorkspaceAuthError).code).toBe(
        'INVALID_FIREBASE_TOKEN'
      )
    })

    it('throws WorkspaceAuthError with code TOKEN_EXCHANGE_FAILED on other errors', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(
        async () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
            statusText: 'Internal Server Error'
          })
      )

      const store = useWorkspaceAuthStore()
      const { error } = storeToRefs(store)

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        WorkspaceAuthError
      )

      expect(error.value).toBeInstanceOf(WorkspaceAuthError)
      expect((error.value as WorkspaceAuthError).code).toBe(
        'TOKEN_EXCHANGE_FAILED'
      )
      expect((error.value as WorkspaceAuthError).message).toContain(
        'Server error'
      )
    })

    it('sends correct request to API', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-123')

      expect(fetch).toHaveBeenCalledWith(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer firebase-token-xyz',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workspace_id: 'workspace-123' })
      })
    })
  })

  describe('clearWorkspaceContext', () => {
    it('clears all state refs', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, error, isAuthenticated } =
        storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(isAuthenticated.value).toBe(true)

      store.clearWorkspaceContext()

      expect(currentWorkspace.value).toBeNull()
      expect(workspaceToken.value).toBeNull()
      expect(error.value).toBeNull()
      expect(isAuthenticated.value).toBe(false)
    })

    it('clears sessionStorage', async () => {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(mockWorkspaceWithRole)
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, 'some-token')
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT, '12345')

      const store = useWorkspaceAuthStore()

      store.clearWorkspaceContext()

      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)
      ).toBeNull()
    })

    it('prevents in-flight refreshes from restoring cleared state', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, isAuthenticated, error } =
        storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(isAuthenticated.value).toBe(true)

      let resolveRefreshFetch: (value: Response) => void = () => {}
      const refreshFetchPromise = new Promise<Response>((resolve) => {
        resolveRefreshFetch = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      store.clearWorkspaceContext()

      resolveRefreshFetch(
        Response.json({
          ...mockTokenResponse,
          token: 'restored-token'
        })
      )
      await refreshPromise

      expect(currentWorkspace.value).toBeNull()
      expect(workspaceToken.value).toBeNull()
      expect(isAuthenticated.value).toBe(false)
      expect(error.value).toBeNull()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)
      ).toBeNull()
    })
  })

  describe('getWorkspaceAuthHeader', () => {
    it('returns null when no workspace token', () => {
      const store = useWorkspaceAuthStore()

      const header = store.getWorkspaceAuthHeader()

      expect(header).toBeNull()
    })

    it('returns proper Authorization header when workspace token exists', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-123')
      const header = store.getWorkspaceAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer workspace-token-abc'
      })
    })
  })

  describe('ensureWorkspaceAuthHeader', () => {
    it('returns the existing header without minting when the token is valid', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')
      expect(fetch).toHaveBeenCalledTimes(1)

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('re-mints instead of returning a token owned by another user', async () => {
      vi.mocked(useAuthStore().getIdToken)
        .mockResolvedValueOnce('firebase-token-a')
        .mockResolvedValueOnce('firebase-token-b')
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(mockTokenResponse))
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            token: 'workspace-token-b'
          })
        )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')
      mockCurrentUser.value = { uid: 'user-b' }

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-b' })
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('mints a token for the preferred workspace when none exists', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const store = useWorkspaceAuthStore()

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-abc' })
    })

    it('coalesces concurrent recovery onto a single mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()

      const [first, second] = await Promise.all([
        store.ensureWorkspaceAuthHeader('workspace-123'),
        store.ensureWorkspaceAuthHeader('workspace-123')
      ])

      expect(first).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(second).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('awaits an in-flight switch instead of racing a second mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      let resolveResponse: (value: Response) => void = () => {}
      const responsePromise = new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(responsePromise)

      const store = useWorkspaceAuthStore()

      const switchPromise = store.switchWorkspace('workspace-123')
      const ensurePromise = store.ensureWorkspaceAuthHeader('workspace-123')

      resolveResponse(Response.json(mockTokenResponse))
      await switchPromise
      const header = await ensurePromise

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('does not give a previous user waiter the next user token', async () => {
      vi.mocked(useAuthStore().getIdToken).mockImplementation(() =>
        Promise.resolve(`firebase-${useAuthStore().currentUser?.uid}`)
      )
      let resolvePreviousResponse: (value: Response) => void = () => {}
      vi.mocked(fetch)
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            resolvePreviousResponse = resolve
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            token: 'workspace-token-b'
          })
        )

      const store = useWorkspaceAuthStore()
      const previousHeader = store.ensureWorkspaceAuthHeader('workspace-123')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

      mockCurrentUser.value = { uid: 'user-b' }
      store.clearWorkspaceContext()
      await store.switchWorkspace('workspace-123')

      resolvePreviousResponse(
        Response.json({
          ...mockTokenResponse,
          token: 'workspace-token-a'
        })
      )

      await expect(previousHeader).resolves.toBeNull()
      expect(store.workspaceToken).toBe('workspace-token-b')
      expect(store.currentWorkspace?.id).toBe('workspace-123')
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('returns null (never a downgrade) when recovery fails transiently', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json({}, { status: 500, statusText: 'Internal Server Error' })
      )

      const store = useWorkspaceAuthStore()

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toBeNull()
    })

    it('returns null when there is no workspace to recover to', async () => {
      const store = useWorkspaceAuthStore()

      const header = await store.ensureWorkspaceAuthHeader()

      expect(header).toBeNull()
    })

    it('tears down workspace context and surfaces a toast on a permanent recovery failure', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'Access denied' }), {
            status: 403,
            statusText: 'Forbidden'
          })
      )
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace } = storeToRefs(store)
      await store.switchWorkspace('workspace-123')

      const token = await store.ensureWorkspaceToken('workspace-999')

      expect(token).toBeNull()
      expect(currentWorkspace.value).toBeNull()
      expect(useToast().error).toHaveBeenCalledTimes(1)
    })

    it.for([
      {
        ssoEnabled: false,
        toasts: ['workspaceAuth.errors.accessDenied'],
        shown: false,
        reloads: 1
      },
      { ssoEnabled: true, toasts: [], shown: true, reloads: 0 }
    ])(
      'a recovery refused with sso_required tears down; the SSO screen replaces the toast and the reload: $shown (sso_enabled $ssoEnabled)',
      async ({ ssoEnabled, toasts, shown, reloads }) => {
        vi.mocked(useFeatureFlags().flags).ssoEnabled = ssoEnabled
        vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
          'firebase-token-xyz'
        )
        vi.mocked(fetch)
          .mockResolvedValueOnce(Response.json(mockTokenResponse))
          .mockImplementation(async () =>
            Response.json(
              { code: 'sso_required', message: 'use SSO' },
              { status: 403 }
            )
          )

        const store = useWorkspaceAuthStore()
        const { currentWorkspace } = storeToRefs(store)
        await store.switchWorkspace('workspace-123')

        const token = await store.ensureWorkspaceToken('workspace-999')
        await vi.dynamicImportSettled()

        expect(token).toBeNull()
        expect(currentWorkspace.value).toBeNull()
        expect(
          vi
            .mocked(useToast().error)
            .mock.calls.map(([, options]) => options?.description)
        ).toEqual(toasts)
        expect(useDialogStore().isDialogOpen(SSO_REQUIRED_DIALOG_KEY)).toBe(
          shown
        )
        expect(mockReload).toHaveBeenCalledTimes(reloads)
      }
    )

    it('names an sso_required refusal SSO_REQUIRED and keeps the access-denied message', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(
          { code: 'sso_required', message: 'use SSO' },
          { status: 403 }
        )
      )

      const store = useWorkspaceAuthStore()

      await expect(store.switchWorkspace('workspace-123')).rejects.toEqual(
        expect.objectContaining({
          code: 'SSO_REQUIRED',
          message: 'workspaceAuth.errors.accessDenied'
        })
      )
    })

    it('backs off re-minting after a failed recovery instead of retrying every call', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () =>
        Response.json({}, { status: 500, statusText: 'Internal Server Error' })
      )

      const store = useWorkspaceAuthStore()

      const first = await store.ensureWorkspaceToken('workspace-123')
      const second = await store.ensureWorkspaceToken('workspace-123')

      expect(first).toBeNull()
      expect(second).toBeNull()
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('forgets the revoked active workspace on a permanent workspace-selection failure', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(
        async () =>
          new Response(JSON.stringify({ message: 'Access denied' }), {
            status: 403,
            statusText: 'Forbidden'
          })
      )

      const store = useWorkspaceAuthStore()

      const token = await store.ensureWorkspaceToken('workspace-123')

      expect(token).toBeNull()
      expect(
        useTeamWorkspaceStore().forgetRevokedActiveWorkspace
      ).toHaveBeenCalledWith('workspace-123')
    })

    it('does not forget the workspace when the failure is an auth error, not revocation', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(
          { message: 'Invalid token' },
          { status: 401, statusText: 'Unauthorized' }
        )
      )

      const store = useWorkspaceAuthStore()

      const token = await store.ensureWorkspaceToken('workspace-123')

      expect(token).toBeNull()
      expect(
        useTeamWorkspaceStore().forgetRevokedActiveWorkspace
      ).not.toHaveBeenCalled()
    })

    it('preserves a valid context on a transient Firebase network failure while signed in', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { currentWorkspace } = storeToRefs(store)
      await store.switchWorkspace('workspace-123')

      mockCurrentUser.value = { uid: 'user-a' }
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(undefined)

      const token = await store.ensureWorkspaceToken('workspace-999')

      expect(token).toBeNull()
      expect(currentWorkspace.value?.id).toBe('workspace-123')
      expect(useToast().error).not.toHaveBeenCalled()
      expect(
        useTeamWorkspaceStore().forgetRevokedActiveWorkspace
      ).not.toHaveBeenCalled()
    })

    it('collapses a burst of waiters into a single mint after a shared in-flight switch rejects', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({}, { status: 500, statusText: 'Internal Server Error' })
      )

      const store = useWorkspaceAuthStore()

      const initialSwitch = store
        .switchWorkspace('workspace-123')
        .catch(() => {})
      const [first, second] = await Promise.all([
        store.ensureWorkspaceToken('workspace-123'),
        store.ensureWorkspaceToken('workspace-123')
      ])
      await initialSwitch

      expect(first).toBe('workspace-token-abc')
      expect(second).toBe('workspace-token-abc')
      // One failed initial switch + exactly one recovery mint the burst shares.
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('re-mints for the requested workspace rather than returning an in-flight switch to a different one', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation((_url, options) => {
        const { workspace_id: workspaceId } = JSON.parse(String(options?.body))
        return Promise.resolve(
          Response.json({
            ...mockTokenResponse,
            token: `token-${workspaceId}`,
            workspace: { ...mockWorkspace, id: workspaceId }
          })
        )
      })

      const store = useWorkspaceAuthStore()

      const switchPromise = store.switchWorkspace('workspace-other')
      const token = await store.ensureWorkspaceToken('workspace-123')
      await switchPromise

      expect(token).toBe('token-workspace-123')
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('does not restore a stale local selection after another switch completes', async () => {
      mockDistributionTypes.isCloud = false
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-123'
      })
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation((_url, options) => {
        const { workspace_id: workspaceId } = JSON.parse(String(options?.body))
        if (workspaceId === 'workspace-other') {
          Object.assign(useTeamWorkspaceStore(), {
            activeWorkspaceId: workspaceId
          })
        }
        return Promise.resolve(
          Response.json({
            ...mockTokenResponse,
            token: `token-${workspaceId}`,
            workspace: { ...mockWorkspace, id: workspaceId }
          })
        )
      })

      const store = useWorkspaceAuthStore()
      const switchPromise = store.switchWorkspace('workspace-other')
      const token = await store.ensureWorkspaceToken('workspace-123')
      await switchPromise

      expect(token).toBeNull()
      expect(store.currentWorkspace?.id).toBe('workspace-other')
      expect(fetch).toHaveBeenCalledOnce()
    })
  })

  describe('token refresh scheduling', () => {
    it('schedules token refresh 5 minutes before expiry', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(Date.now() + expiresInMs).toISOString()
      }
      respondToFetch(TOKEN_URL, () =>
        Response.json(tokenResponseWithFutureExpiry)
      )

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-123')

      expect(fetch).toHaveBeenCalledTimes(1)

      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs

      vi.advanceTimersByTime(refreshDelay - 1)
      expect(fetch).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1)

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('clears context when refresh fails with ACCESS_DENIED', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(Date.now() + expiresInMs).toISOString()
      }
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(tokenResponseWithFutureExpiry))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'Access denied' }), {
            status: 403,
            statusText: 'Forbidden'
          })
        )

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)
      let workspaceWhenRevocationHandled: string | null = null
      const cancelWorkflowTransition = vi.fn()
      mockPrepareWorkflowWorkspaceTransition.mockReturnValue(
        cancelWorkflowTransition
      )
      vi.mocked(
        useTeamWorkspaceStore().forgetRevokedActiveWorkspace
      ).mockImplementation(() => {
        workspaceWhenRevocationHandled = sessionStorage.getItem(
          WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE
        )
        return true
      })

      await store.switchWorkspace('workspace-123')
      expect(workspaceToken.value).toBe('workspace-token-abc')

      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs

      vi.advanceTimersByTime(refreshDelay)
      await vi.waitFor(() => {
        expect(currentWorkspace.value).toBeNull()
      })

      expect(workspaceToken.value).toBeNull()
      expect(workspaceWhenRevocationHandled).toBe(
        JSON.stringify(mockWorkspaceWithRole)
      )
      expect(cancelWorkflowTransition).toHaveBeenCalledOnce()
      expect(mockReload).not.toHaveBeenCalled()
    })
  })

  describe('refreshToken', () => {
    it('does nothing when no current workspace', async () => {
      const store = useWorkspaceAuthStore()

      await store.refreshToken()

      expect(fetch).not.toHaveBeenCalled()
    })

    it('refreshes token for current workspace', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(fetch).toHaveBeenCalledTimes(1)

      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...mockTokenResponse,
          token: 'refreshed-token'
        })
      )

      await store.refreshToken()
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(workspaceToken.value).toBe('refreshed-token')
    })
  })

  describe('isAuthenticated computed', () => {
    it('returns true when both workspace and token are present', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { isAuthenticated } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      expect(isAuthenticated.value).toBe(true)
    })

    it('returns false when workspace is null', () => {
      const store = useWorkspaceAuthStore()
      const { isAuthenticated } = storeToRefs(store)

      expect(isAuthenticated.value).toBe(false)
    })

    it('returns false when currentWorkspace is set but workspaceToken is null', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(undefined)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, isAuthenticated } =
        storeToRefs(store)

      currentWorkspace.value = mockWorkspaceWithRole
      workspaceToken.value = null

      expect(isAuthenticated.value).toBe(false)
    })
  })

  describe('refreshToken retry/race paths', () => {
    it('ends an expired workspace session behind the workflow write barrier', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresAt = Date.now() + 3600 * 1000
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...mockTokenResponse,
          expires_at: new Date(expiresAt).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')

      respondToFetch(TOKEN_URL, () =>
        Response.json(
          { message: 'Server error' },
          { status: 500, statusText: 'Internal Server Error' }
        )
      )
      vi.setSystemTime(expiresAt + 1)
      mockPrepareWorkflowWorkspaceTransition.mockImplementation(() => {
        expect(
          sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
        ).toBe(JSON.stringify(mockWorkspaceWithRole))
      })

      const refreshPromise = store.refreshToken()
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await refreshPromise

      expect(mockPrepareWorkflowWorkspaceTransition).toHaveBeenCalledOnce()
      expect(mockReload).toHaveBeenCalledOnce()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBeNull()
      randomSpy.mockRestore()
    })

    it('retries up to 3 times with exponential backoff on TOKEN_EXCHANGE_FAILED, then preserves valid context', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      // Initial successful switchWorkspace establishes context.
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, error } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('workspace-token-abc')

      // Subsequent refresh attempts all fail with 500 (TOKEN_EXCHANGE_FAILED).
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
            statusText: 'Internal Server Error'
          })
      )

      const refreshPromise = store.refreshToken()

      // Drain only the retry backoff delays; do not advance to the scheduled
      // proactive refresh timer for the still-valid token.
      await vi.advanceTimersByTimeAsync(1500)
      await vi.advanceTimersByTimeAsync(2500)
      await vi.advanceTimersByTimeAsync(4500)
      await refreshPromise

      // 1 initial switchWorkspace + 4 refresh attempts = 5 total fetch calls.
      expect(fetch).toHaveBeenCalledTimes(5)
      // Each exponential-backoff delay includes bounded jitter.
      expect(
        vi
          .mocked(console.warn)
          .mock.calls.some((c) => /retrying in 1500ms/.test(String(c[0])))
      ).toBe(true)
      expect(
        vi
          .mocked(console.warn)
          .mock.calls.some((c) => /retrying in 2500ms/.test(String(c[0])))
      ).toBe(true)
      expect(
        vi
          .mocked(console.warn)
          .mock.calls.some((c) => /retrying in 4500ms/.test(String(c[0])))
      ).toBe(true)

      // After the final transient failure the still-valid context is preserved.
      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('workspace-token-abc')
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBe(JSON.stringify(mockWorkspaceWithRole))
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'workspace-token-abc'
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)).toBe(
        expectedExpiresAtMs(mockTokenResponse.expires_at)
      )
      expect(error.value).toBeNull()
      expect(console.error).not.toHaveBeenCalled()

      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...mockTokenResponse, token: 'retry-token' })
      )

      // The scheduled retry also includes bounded jitter (8000ms + 500ms).
      await vi.advanceTimersByTimeAsync(8499)
      expect(fetch).toHaveBeenCalledTimes(5)

      await vi.advanceTimersByTimeAsync(1)
      expect(fetch).toHaveBeenCalledTimes(6)
      await vi.waitFor(() => {
        expect(workspaceToken.value).toBe('retry-token')
      })

      vi.mocked(console.warn).mockRestore()
      randomSpy.mockRestore()
    })

    it('does not let an in-flight refresh re-arm timers after destroy', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')

      let resolveRefreshFetch: (value: Response) => void = () => {}
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveRefreshFetch = resolve
        })
      )

      const refreshPromise = store.refreshToken()
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
      store.destroy()
      resolveRefreshFetch(
        Response.json({
          ...mockTokenResponse,
          token: 'late-refresh-token'
        })
      )
      await refreshPromise

      expect(store.workspaceToken).toBe('workspace-token-abc')
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('clears context immediately on INVALID_FIREBASE_TOKEN without retrying', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(currentWorkspace.value).not.toBeNull()

      // Permanent error: 401 → INVALID_FIREBASE_TOKEN.
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'Invalid token' }), {
            status: 401,
            statusText: 'Unauthorized'
          })
      )

      await store.refreshToken()

      // Initial + exactly one refresh attempt; no retries on permanent errors.
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(currentWorkspace.value).toBeNull()
    })

    it.for([
      { ssoEnabled: false, shown: false, reloads: 1 },
      { ssoEnabled: true, shown: true, reloads: 0 }
    ])(
      'a refresh refused with sso_required shows the SSO screen instead of reloading: $shown (sso_enabled $ssoEnabled)',
      async ({ ssoEnabled, shown, reloads }) => {
        vi.mocked(useFeatureFlags().flags).ssoEnabled = ssoEnabled
        vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
          'firebase-token-xyz'
        )
        vi.mocked(fetch)
          .mockResolvedValueOnce(Response.json(mockTokenResponse))
          .mockImplementation(async () =>
            Response.json(
              { code: 'sso_required', message: 'use SSO' },
              { status: 403 }
            )
          )

        const store = useWorkspaceAuthStore()
        const { currentWorkspace } = storeToRefs(store)
        await store.switchWorkspace('workspace-123')

        await store.refreshToken()
        await vi.dynamicImportSettled()

        expect(currentWorkspace.value).toBeNull()
        expect(useDialogStore().isDialogOpen(SSO_REQUIRED_DIALOG_KEY)).toBe(
          shown
        )
        expect(mockReload).toHaveBeenCalledTimes(reloads)
      }
    )

    it('keeps the old workspace refresh when a newer workspace switch fails', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      let resolveRefreshFetch: (value: Response) => void = () => {}
      const refreshFetchPromise = new Promise<Response>((resolve) => {
        resolveRefreshFetch = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Access denied' }), {
          status: 403,
          statusText: 'Forbidden'
        })
      )
      await expect(store.switchWorkspace('workspace-other')).rejects.toThrow(
        WorkspaceAuthError
      )

      const refreshedExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      resolveRefreshFetch(
        Response.json({
          ...mockTokenResponse,
          token: 'refreshed-workspace-token',
          expires_at: refreshedExpiry
        })
      )
      await refreshPromise

      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('refreshed-workspace-token')
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'refreshed-workspace-token'
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)).toBe(
        expectedExpiresAtMs(refreshedExpiry)
      )
    })

    it('allows same-workspace switches to leave in-flight refreshes valid', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      let resolveRefreshFetch: (value: Response) => void = () => {}
      const refreshFetchPromise = new Promise<Response>((resolve) => {
        resolveRefreshFetch = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      const sameWorkspaceExpiry = new Date(
        Date.now() + 7200 * 1000
      ).toISOString()
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...mockTokenResponse,
          token: 'same-workspace-token',
          expires_at: sameWorkspaceExpiry
        })
      )
      await store.switchWorkspace('workspace-123')

      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('same-workspace-token')

      const refreshedExpiry = new Date(Date.now() + 9000 * 1000).toISOString()
      resolveRefreshFetch(
        Response.json({
          ...mockTokenResponse,
          token: 'refreshed-workspace-token',
          expires_at: refreshedExpiry
        })
      )
      await refreshPromise

      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('refreshed-workspace-token')
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'refreshed-workspace-token'
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)).toBe(
        expectedExpiresAtMs(refreshedExpiry)
      )
    })

    it('the new workspace wins when the stale refresh resolves last', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      // Hang the next fetch — this is the refresh's switchWorkspace fetch.
      let resolveRefreshFetch: (value: Response) => void = () => {}
      const refreshFetchPromise = new Promise<Response>((resolve) => {
        resolveRefreshFetch = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      // User switches workspace AND its fetch resolves first.
      const newWorkspace = { ...mockWorkspace, id: 'workspace-other' }
      const newExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...mockTokenResponse,
          token: 'new-workspace-token',
          expires_at: newExpiry,
          workspace: newWorkspace
        })
      )
      await store.switchWorkspace('workspace-other')

      // New workspace is committed at this point.
      expect(currentWorkspace.value?.id).toBe('workspace-other')
      expect(workspaceToken.value).toBe('new-workspace-token')
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBe(JSON.stringify({ ...newWorkspace, role: 'owner' }))
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'new-workspace-token'
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)).toBe(
        expectedExpiresAtMs(newExpiry)
      )

      // Now resolve the stale refresh fetch — it carries an OLD-workspace
      // token. It must not clobber the new workspace state or sessionStorage.
      const staleExpiry = new Date(Date.now() + 1800 * 1000).toISOString()
      resolveRefreshFetch(
        Response.json({
          ...mockTokenResponse,
          token: 'stale-token',
          expires_at: staleExpiry
        })
      )
      await refreshPromise

      expect(currentWorkspace.value?.id).toBe('workspace-other')
      expect(workspaceToken.value).toBe('new-workspace-token')
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBe(JSON.stringify({ ...newWorkspace, role: 'owner' }))
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'new-workspace-token'
      )
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)).toBe(
        expectedExpiresAtMs(newExpiry)
      )
    })

    it('blocks a stale refresh that resolves after switch-away-and-back to same workspace', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      // Hang the refresh fetch so it resolves after both switches below.
      let resolveRefreshFetch: (value: Response) => void = () => {}
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveRefreshFetch = resolve
        })
      )
      const refreshPromise = store.refreshToken()

      // Switch away to a different workspace...
      const otherExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...mockTokenResponse,
          token: 'other-workspace-token',
          expires_at: otherExpiry,
          workspace: { ...mockTokenResponse.workspace, id: 'workspace-other' }
        })
      )
      await store.switchWorkspace('workspace-other')
      expect(workspaceToken.value).toBe('other-workspace-token')

      // ...and back to the original workspace.
      const backExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...mockTokenResponse,
          token: 'back-workspace-token',
          expires_at: backExpiry
        })
      )
      await store.switchWorkspace('workspace-123')
      expect(workspaceToken.value).toBe('back-workspace-token')

      // Stale refresh resolves with an old token — must not clobber state.
      resolveRefreshFetch(
        Response.json({ ...mockTokenResponse, token: 'stale-token' })
      )
      await refreshPromise

      expect(currentWorkspace.value?.id).toBe('workspace-123')
      expect(workspaceToken.value).toBe('back-workspace-token')
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'back-workspace-token'
      )
    })

    it('the new workspace keeps clean error state when a stale refresh fails last', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      vi.mocked(fetch).mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, error } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      let resolveRefreshFetch: (value: Response) => void = () => {}
      const refreshFetchPromise = new Promise<Response>((resolve) => {
        resolveRefreshFetch = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      const newWorkspace = { ...mockWorkspace, id: 'workspace-other' }
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...mockTokenResponse,
          token: 'new-workspace-token',
          workspace: newWorkspace
        })
      )
      await store.switchWorkspace('workspace-other')

      resolveRefreshFetch(
        new Response(JSON.stringify({ message: 'Server error' }), {
          status: 500,
          statusText: 'Internal Server Error'
        })
      )
      await refreshPromise

      expect(currentWorkspace.value?.id).toBe('workspace-other')
      expect(workspaceToken.value).toBe('new-workspace-token')
      expect(error.value).toBeNull()
    })
  })

  describe('persistToSession resilience', () => {
    it('updates store state even when sessionStorage.setItem throws', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(mockTokenResponse)
      )

      const originalSessionStorage = globalThis.sessionStorage
      // happy-dom Storage method spies can miss instance calls; replace the
      // object so every setItem call deterministically throws.
      const throwingSessionStorage = {
        get length() {
          return originalSessionStorage.length
        },
        key: originalSessionStorage.key.bind(originalSessionStorage),
        getItem: originalSessionStorage.getItem.bind(originalSessionStorage),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError')
        }),
        removeItem: originalSessionStorage.removeItem.bind(
          originalSessionStorage
        ),
        clear: originalSessionStorage.clear.bind(originalSessionStorage)
      } satisfies Storage
      vi.stubGlobal('sessionStorage', throwingSessionStorage)

      try {
        const store = useWorkspaceAuthStore()
        const { workspaceToken } = storeToRefs(store)

        await store.switchWorkspace('workspace-123')

        expect(workspaceToken.value).toBe('workspace-token-abc')
        expect(console.warn).toHaveBeenCalledWith(
          'Failed to persist workspace identity to sessionStorage'
        )
      } finally {
        vi.stubGlobal('sessionStorage', originalSessionStorage)
        vi.mocked(console.warn).mockRestore()
      }
    })
  })

  describe('Zod validation on token response', () => {
    it('throws TOKEN_EXCHANGE_FAILED when the response is missing required fields', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json({
          token: 'token-only',
          // missing expires_at, workspace, role, permissions
          role: 'owner'
        })
      )

      const store = useWorkspaceAuthStore()
      const { error } = storeToRefs(store)

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        WorkspaceAuthError
      )
      expect((error.value as WorkspaceAuthError).code).toBe(
        'TOKEN_EXCHANGE_FAILED'
      )
    })
  })

  describe('unified Cloud-JWT lifecycle (unified_cloud_auth)', () => {
    const personalTokenResponse = {
      token: 'unified-token-1',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      workspace: {
        id: 'workspace-personal',
        name: 'Personal',
        type: 'personal' as const
      },
      role: 'owner' as const,
      permissions: ['owner:*']
    }

    beforeEach(() => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
    })

    it('mintAtLogin is a no-op and returns false when the flag is OFF', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      const result = await store.mintAtLogin()

      expect(result).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBeNull()
    })

    it('a port that delivers synchronously inside onUserChanged still leaves the store subscribed and minting for that user', async () => {
      const syncPort = replayIdentityPort(
        () => portUser(useAuthStore().currentUser),
        'sync'
      )
      vi.spyOn(firebaseIdentity, 'onUserChanged').mockImplementation(
        syncPort.register
      )
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(personalTokenResponse)
      )

      const store = useWorkspaceAuthStore()

      expect(syncPort.observers.size, 'the port stays subscribed').toBe(1)
      await expect(store.mintAtLogin()).resolves.toBe(true)
      expect(store.getUnifiedToken()).toBe('unified-token-1')
    })

    it('mints the personal default once into the dormant unifiedToken slot when flag ON', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()
      const { unifiedToken, workspaceToken } = storeToRefs(store)

      const result = await store.mintAtLogin()

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(1)
      // Personal default mints with an id-less empty body.
      expect(fetch).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({})
        })
      )
      expect(unifiedToken.value).toBe('unified-token-1')
      // Dormant slot proof: the legacy workspace token is never written.
      expect(workspaceToken.value).toBeNull()
    })

    it('retires a saved legacy token when a unified mint enters the rail', async () => {
      const futureExpiry = Date.now() + 3600 * 1000
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(mockWorkspaceWithRole)
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, 'legacy-team-token')
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        futureExpiry.toString()
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.OWNER_UID, 'user-a')
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(personalTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { workspaceToken, unifiedToken } = storeToRefs(store)
      store.initializeFromSession()
      expect(workspaceToken.value).toBe('legacy-team-token')

      await store.mintAtLogin()

      expect(unifiedToken.value).toBe('unified-token-1')
      expect(
        workspaceToken.value,
        'a flag rollback must not resurrect the stale legacy token'
      ).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
    })

    it('mints the current target when the flag flips on', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      await vi.waitFor(() => {
        expect(unifiedToken.value).toBe('unified-token-1')
      })

      expect(
        fetch,
        'a remote rollout must mint before consumers switch rails, or the session goes headerless'
      ).toHaveBeenCalledTimes(1)
    })

    it('does not re-mint when unifiedToken is already populated', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()

      await store.mintAtLogin()
      const result = await store.mintAtLogin()

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('re-mints when the existing unified token belongs to another user', async () => {
      vi.mocked(useAuthStore().getIdToken)
        .mockResolvedValueOnce('firebase-token-a')
        .mockResolvedValueOnce('firebase-token-b')
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(personalTokenResponse))
        .mockResolvedValueOnce(
          Response.json({ ...personalTokenResponse, token: 'unified-b' })
        )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      mockCurrentUser.value = { uid: 'user-b' }

      const result = await store.mintAtLogin()

      expect(result).toBe(true)
      expect(store.unifiedToken).toBe('unified-b')
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('arms a refresh at expires_at - buffer and re-mints from the parsed expiry (no hardcoded TTL)', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()

      await store.mintAtLogin()
      expect(fetch).toHaveBeenCalledTimes(1)

      const refreshDelay = expiresInMs - 5 * 60 * 1000

      vi.advanceTimersByTime(refreshDelay - 1)
      expect(fetch).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('does not bump the rotation trigger on the initial login mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(personalTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()

      expect(useAuthStore().notifyTokenRefreshed).not.toHaveBeenCalled()
    })

    it('does not bump the rotation trigger on a workspace switch', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')

      expect(mockEnsureSessionCookie).toHaveBeenCalledOnce()
      expect(fetch).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.objectContaining({
          body: JSON.stringify({ workspace_id: 'workspace-123' })
        })
      )
      expect(store.getUnifiedToken()).toBe('workspace-token-abc')
      expect(store.workspaceToken).toBeNull()
      expect(useAuthStore().notifyTokenRefreshed).not.toHaveBeenCalled()
    })

    it('scopes workflow persistence to each unified workspace', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const secondWorkspace = {
        ...mockWorkspaceWithRole,
        id: 'workspace-456'
      }
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(mockTokenResponse))
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            workspace: secondWorkspace
          })
        )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')

      expect(store.currentWorkspace).toEqual(mockWorkspaceWithRole)
      expect(getWorkspaceId()).toBe('workspace-123')
      expect(StorageKeys.draftIndex(getWorkspaceId())).toBe(
        'Comfy.Workflow.DraftIndex.v2:workspace-123'
      )

      await store.switchWorkspace('workspace-456')

      expect(store.currentWorkspace).toEqual(secondWorkspace)
      expect(getWorkspaceId()).toBe('workspace-456')
      expect(StorageKeys.draftIndex(getWorkspaceId())).toBe(
        'Comfy.Workflow.DraftIndex.v2:workspace-456'
      )
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBe(JSON.stringify(secondWorkspace))
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
    })

    it('does not retry an old workspace request with a new workspace token', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            token: 'workspace-a-token',
            workspace: { ...mockWorkspace, id: 'workspace-a' }
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            token: 'workspace-b-token',
            workspace: { ...mockWorkspace, id: 'workspace-b' }
          })
        )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-a')
      await store.switchWorkspace('workspace-b')

      await expect(
        store.remintUnifiedOnce('workspace-a-token')
      ).resolves.toBeNull()
      expect(store.getUnifiedToken()).toBe('workspace-b-token')
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('a failed workspace switch does not become the next login mint target', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'revoked' }), {
            status: 403,
            statusText: 'Forbidden'
          })
        )
        .mockResolvedValueOnce(Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()
      await expect(store.switchWorkspace('workspace-revoked')).rejects.toThrow()

      const result = await store.mintAtLogin()

      expect(result).toBe(true)
      expect(
        JSON.parse(String(fetchRequests(TOKEN_URL)[1].body)),
        'the login must fall back to the personal default, not retry the workspace that refused us'
      ).toEqual({})
      expect(store.unifiedToken).toBe('unified-token-1')
    })

    it('a slower login mint resolving after a workspace switch never reverts it', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      let releaseCookie!: () => void
      mockEnsureSessionCookie.mockImplementationOnce(
        () => new Promise<void>((resolve) => (releaseCookie = resolve))
      )
      let releasePersonal!: (response: Response) => void
      vi.mocked(fetch)
        .mockImplementationOnce(
          () => new Promise<Response>((resolve) => (releasePersonal = resolve))
        )
        .mockResolvedValueOnce(Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      const switching = store.switchWorkspace('workspace-123')
      const loggingIn = store.mintAtLogin()
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())

      releaseCookie()
      await switching
      expect(store.getUnifiedToken()).toBe('workspace-token-abc')

      releasePersonal(Response.json(personalTokenResponse))
      await expect(
        loggingIn,
        'the login still reports success: its personal mint was superseded, not lost'
      ).resolves.toBe(true)
      expect(
        store.getUnifiedToken(),
        'a login mint for the personal default resolving late must not silently revert the switch'
      ).toBe('workspace-token-abc')
    })

    it('does not let an old workspace retry supersede a pending switch', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      let resolveWorkspaceB: (value: Response) => void = () => {}
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          Response.json({
            ...mockTokenResponse,
            token: 'workspace-a-token',
            workspace: { ...mockWorkspace, id: 'workspace-a' }
          })
        )
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            resolveWorkspaceB = resolve
          })
        )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-a')
      const switchToB = store.switchWorkspace('workspace-b')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))

      await expect(
        store.remintUnifiedOnce('workspace-a-token')
      ).resolves.toBeNull()
      expect(fetch).toHaveBeenCalledTimes(2)

      resolveWorkspaceB(
        Response.json({
          ...mockTokenResponse,
          token: 'workspace-b-token',
          workspace: { ...mockWorkspace, id: 'workspace-b' }
        })
      )
      await switchToB

      expect(store.getUnifiedToken()).toBe('workspace-b-token')
    })

    it('fails closed when switching workspaces fails', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(mockTokenResponse))
        .mockResolvedValueOnce(
          Response.json(
            { message: 'try again' },
            { status: 500, statusText: 'Internal Server Error' }
          )
        )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')

      await expect(store.switchWorkspace('workspace-b')).rejects.toThrow()
      expect(store.getUnifiedToken()).toBeUndefined()
      await expect(
        store.remintUnifiedOnce('workspace-token-abc')
      ).resolves.toBeNull()
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('bumps the rotation trigger exactly once on a refresh re-mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()

      const refreshDelay = expiresInMs - 5 * 60 * 1000
      await vi.advanceTimersByTimeAsync(refreshDelay)

      expect(useAuthStore().notifyTokenRefreshed).toHaveBeenCalledTimes(1)
    })

    it('bumps the rotation trigger on a successful reactive re-mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(personalTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      expect(useAuthStore().notifyTokenRefreshed).not.toHaveBeenCalled()

      await store.remintUnifiedOnce('unified-token-1')

      expect(useAuthStore().notifyTokenRefreshed).toHaveBeenCalledTimes(1)
    })

    it('remintUnifiedOnce re-mints once and, on a permanent failure, surfaces it and tears down without looping', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'Invalid token' }), {
            status: 401,
            statusText: 'Unauthorized'
          })
      )
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json(personalTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, unifiedToken } = storeToRefs(store)
      await store.mintAtLogin()
      expect(fetch).toHaveBeenCalledTimes(1)

      const result = await store.remintUnifiedOnce('unified-token-1')

      // Exactly one re-mint attempt — the primitive does not retry.
      expect(fetch).toHaveBeenCalledTimes(2)
      // A permanent failure resolves to null (the caller surfaces its 401),
      // fires the error toast keyed to the 401 code, and clears the dead session.
      expect(result).toBeNull()
      expect(useToast().error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          description: 'workspaceAuth.errors.invalidFirebaseToken'
        })
      )
      expect(unifiedToken.value).toBeNull()
      expect(currentWorkspace.value).toBeNull()
      expect(
        sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      ).toBeNull()
      expect(mockPrepareWorkflowWorkspaceTransition).toHaveBeenCalledOnce()
      expect(mockReload).toHaveBeenCalledOnce()
    })

    it('remintUnifiedOnce does not toast or clear the slot on a transient re-mint failure', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      // A transient backend failure must not alarm the user or wipe the slot.
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'try again' }), {
            status: 500,
            statusText: 'Internal Server Error'
          })
      )
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json(personalTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      const result = await store.remintUnifiedOnce('unified-token-1')

      expect(result).toBeNull()
      expect(useToast().error).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBe('unified-token-1')
    })

    it('remintUnifiedOnce returns null without minting when the flag is OFF', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      const store = useWorkspaceAuthStore()

      const result = await store.remintUnifiedOnce('unified-token-1')

      expect(result).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('does not retry an old account request with the current account token', async () => {
      vi.mocked(useAuthStore().getIdToken)
        .mockResolvedValueOnce('firebase-token-a')
        .mockResolvedValueOnce('firebase-token-b')
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(personalTokenResponse))
        .mockResolvedValueOnce(
          Response.json({ ...personalTokenResponse, token: 'unified-b' })
        )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      mockCurrentUser.value = { uid: 'user-b' }
      await store.mintAtLogin()

      const result = await store.remintUnifiedOnce('unified-token-1')

      expect(result).toBeNull()
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('evicts an expired unified-token context past the grace window on the next mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const base = Date.now()
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          Response.json({
            ...personalTokenResponse,
            token: 'unified-token-1',
            expires_at: new Date(base + 3600 * 1000).toISOString()
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            ...personalTokenResponse,
            token: 'unified-token-2',
            expires_at: new Date(base + 10 * 3600 * 1000).toISOString()
          })
        )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()

      // Jump well past token-1's expiry plus the retention grace window without
      // firing the scheduled refresh timer.
      vi.setSystemTime(base + 2 * 3600 * 1000)

      // Re-minting the current token writes token-2 and prunes the stale entry.
      expect(await store.remintUnifiedOnce('unified-token-1')).toBe(
        'unified-token-2'
      )

      // token-1's context is gone: a late 401 replay for it now fails closed
      // instead of resolving to the fresh token off a never-evicted entry.
      expect(await store.remintUnifiedOnce('unified-token-1')).toBeNull()
    })

    it('ignores a stale unified mint failure after account state is cleared', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-token-a')
      let resolveResponse: (value: Response) => void = () => {}
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        })
      )

      const store = useWorkspaceAuthStore()
      const mintPromise = store.mintAtLogin()
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
      store.clearWorkspaceContext()
      resolveResponse(
        Response.json(
          { message: 'old account' },
          { status: 401, statusText: 'Unauthorized' }
        )
      )

      await expect(mintPromise).resolves.toBe(false)
      expect(store.unifiedToken).toBeNull()
      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('coalesces concurrent re-mints and returns the winning token to every caller', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json(personalTokenResponse)
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      let resolveRemint: (value: Response) => void = () => {}
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveRemint = resolve
        })
      )
      const first = store.remintUnifiedOnce('unified-token-1')
      const second = store.remintUnifiedOnce('unified-token-1')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))

      resolveRemint(
        Response.json({ ...personalTokenResponse, token: 'latest-token' })
      )

      await expect(Promise.all([first, second])).resolves.toEqual([
        'latest-token',
        'latest-token'
      ])
      expect(unifiedToken.value).toBe('latest-token')
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('reuses a same-user burst winner for a later stale 401', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(personalTokenResponse))
        .mockResolvedValueOnce(
          Response.json({ ...personalTokenResponse, token: 'winner-token' })
        )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()

      expect(await store.remintUnifiedOnce('unified-token-1')).toBe(
        'winner-token'
      )
      expect(await store.remintUnifiedOnce('unified-token-1')).toBe(
        'winner-token'
      )
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('clears unifiedToken and stops the unified timer on clearWorkspaceContext', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()
      expect(unifiedToken.value).toBe('unified-token-1')

      store.clearWorkspaceContext()
      expect(unifiedToken.value).toBeNull()

      // Timer stopped: advancing past the refresh window triggers no re-mint.
      vi.mocked(fetch).mockClear()
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('destroy disposes the session client and drops the token', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      expect(store.getUnifiedToken()).toBe('unified-token-1')

      store.destroy()

      expect(
        store.getUnifiedToken(),
        'a torn-down store must not keep serving the unified token'
      ).toBeUndefined()
      vi.mocked(fetch).mockClear()
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(fetch).not.toHaveBeenCalled()

      const mintAfterDestroy = store.mintAtLogin()
      await vi.advanceTimersByTimeAsync(UNIFIED_IDENTITY_SETTLE_TIMEOUT_MS)
      await expect(
        mintAfterDestroy,
        'destroy detaches identity with no path back, so a mint waits the settle ceiling and fails closed'
      ).resolves.toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('destroy stops the flag watcher so a later flag flip cannot resubscribe or mint', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      expect(portListeners.size).toBe(1)

      store.destroy()
      expect(
        portListeners.size,
        'destroy must unsubscribe the identity port'
      ).toBe(0)

      vi.mocked(fetch).mockClear()
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      await nextTick()
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      await nextTick()
      await vi.advanceTimersByTimeAsync(0)

      expect(
        portListeners.size,
        'a destroyed store must not resubscribe identity when the flag flips'
      ).toBe(0)
      expect(
        fetch,
        'a destroyed store must not mint when the flag flips'
      ).not.toHaveBeenCalled()
      expect(store.getUnifiedToken()).toBeUndefined()
    })

    it('turning the flag OFF keeps the identity subscribed, clears the slot, and does not mint or refresh while the flag is off', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)
      await store.mintAtLogin()
      expect(unifiedToken.value).toBe('unified-token-1')
      expect(portListeners.size).toBe(1)

      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      await nextTick()

      expect(unifiedToken.value, 'the slot must empty on rollback').toBeNull()
      expect(
        portListeners.size,
        'the port outlives the flag: identity is bound for the store lifetime'
      ).toBe(1)
      await vi.advanceTimersByTimeAsync(expiresInMs)
      expect(
        fetch,
        'no scheduled refresh may run for a disabled feature'
      ).toHaveBeenCalledTimes(1)
      expect(useAuthStore().notifyTokenRefreshed).not.toHaveBeenCalled()

      expect(
        await store.mintAtLogin(),
        'the login mint is the gate: it must refuse while the flag is off'
      ).toBe(false)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(unifiedToken.value).toBeNull()

      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      expect(await store.mintAtLogin()).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(unifiedToken.value).toBe('unified-token-1')
    })

    it('refuses a mint that parked on the identity before the flag went off', async () => {
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      // A port that never replays on its own, so the mint parks on
      // unifiedUser() until we deliver the user by hand.
      const heldPort = replayIdentityPort(() => null)
      vi.spyOn(firebaseIdentity, 'onUserChanged').mockImplementation(
        heldPort.register
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)
      Object.assign(useAuthStore(), { currentUser: { uid: 'user-1' } })
      const parked = store.mintAtLogin()

      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      await nextTick()
      heldPort.emit(portUser({ uid: 'user-1' }))

      await expect(
        parked,
        'a mint that resumes after the rollback must fail closed'
      ).resolves.toBe(false)
      expect(
        fetch,
        'no /auth/token exchange may fire for a disabled feature'
      ).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBeNull()
    })

    it('refuses a mint that parked on the identity before the session signed the tab in', async () => {
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const heldPort = replayIdentityPort(() => null)
      vi.spyOn(firebaseIdentity, 'onUserChanged').mockImplementation(
        heldPort.register
      )
      const signedInScope: WebSessionRequestScope = {
        session: {
          user: { id: 'user-1', email: 'a@example.com', emailVerified: true },
          csrfToken: 'csrf-1',
          expiresAt: Date.now() + 60 * 60_000,
          absoluteExpiresAt: Date.now() + 24 * 60 * 60_000
        },
        epoch: 1
      }
      let signedIn = false
      onTestFinished(
        provideWebSessionRequests(
          fromPartial<WebSessionRequests>({
            scope: async () => (signedIn ? signedInScope : undefined)
          })
        )
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)
      Object.assign(useAuthStore(), { currentUser: { uid: 'user-1' } })
      const parked = store.mintAtLogin()

      signedIn = true
      await nextTick()
      heldPort.emit(portUser({ uid: 'user-1' }))

      await expect(parked).resolves.toBe(false)
      expect(fetch).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBeNull()
    })

    it('is fully dormant under the flag OFF: no unified network, timer, or rotation', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()
      await store.remintUnifiedOnce('unified-token-1')
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(fetch).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBeNull()
      expect(useAuthStore().notifyTokenRefreshed).not.toHaveBeenCalled()
    })

    it.for([
      {
        status: 403,
        statusText: 'Forbidden',
        detailKey: 'workspaceAuth.errors.accessDenied',
        code: 'ACCESS_DENIED'
      },
      {
        status: 404,
        statusText: 'Not Found',
        detailKey: 'workspaceAuth.errors.workspaceNotFound',
        code: 'WORKSPACE_NOT_FOUND'
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        detailKey: 'workspaceAuth.errors.invalidFirebaseToken',
        code: 'INVALID_FIREBASE_TOKEN'
      }
    ])(
      'surfaces the $status permanent refresh error as a toast and clears the slot',
      async ({ status, statusText, detailKey, code }) => {
        vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
          'firebase-token-xyz'
        )
        const expiresInMs = 3600 * 1000
        // The scheduled refresh is rejected with a permanent code.
        respondToFetch(
          TOKEN_URL,
          () =>
            new Response(JSON.stringify({ message: statusText }), {
              status,
              statusText
            })
        )
        vi.mocked(fetch).mockResolvedValueOnce(
          Response.json({
            ...personalTokenResponse,
            expires_at: new Date(Date.now() + expiresInMs).toISOString()
          })
        )

        const store = useWorkspaceAuthStore()
        const { unifiedToken } = storeToRefs(store)

        await store.mintAtLogin()
        expect(unifiedToken.value).toBe('unified-token-1')

        await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)

        expect(useToast().error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ description: detailKey })
        )
        expect(
          useTelemetry()?.trackUnifiedAuthRefresh
        ).toHaveBeenLastCalledWith({
          outcome: 'permanent_failure',
          retry_count: 0
        })
        expect(reportError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            surface: 'auth',
            errorType: 'failure_refreshing_unified_auth_permanent',
            tags: { failure_code: code, retry_count: 0 },
            // The toast path owns the console line for this failure.
            logToConsole: false
          })
        )
        expect(unifiedToken.value).toBeNull()
      }
    )

    it.for([
      {
        ssoEnabled: false,
        toasts: ['workspaceAuth.errors.accessDenied'],
        shown: false,
        reloads: 1
      },
      { ssoEnabled: true, toasts: [], shown: true, reloads: 0 }
    ])(
      'a refresh refused with sso_required clears the slot; the SSO screen replaces the toast and the reload: $shown (sso_enabled $ssoEnabled)',
      async ({ ssoEnabled, toasts, shown, reloads }) => {
        vi.mocked(useFeatureFlags().flags).ssoEnabled = ssoEnabled
        vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
          'firebase-token-xyz'
        )
        const expiresInMs = 3600 * 1000
        vi.mocked(fetch)
          .mockResolvedValueOnce(
            Response.json({
              ...personalTokenResponse,
              expires_at: new Date(Date.now() + expiresInMs).toISOString()
            })
          )
          .mockImplementation(async () =>
            Response.json(
              { code: 'sso_required', message: 'use SSO' },
              { status: 403 }
            )
          )

        const store = useWorkspaceAuthStore()
        const { unifiedToken } = storeToRefs(store)
        await store.mintAtLogin()

        await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)
        await vi.dynamicImportSettled()

        expect(unifiedToken.value).toBeNull()
        expect(reportError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            tags: { failure_code: 'SSO_REQUIRED', retry_count: 0 }
          })
        )
        expect(
          vi
            .mocked(useToast().error)
            .mock.calls.map(([, options]) => options?.description)
        ).toEqual(toasts)
        expect(useDialogStore().isDialogOpen(SSO_REQUIRED_DIALOG_KEY)).toBe(
          shown
        )
        expect(mockReload).toHaveBeenCalledTimes(reloads)
      }
    )

    it('a signed-out identity before refresh time clears the slot silently and refreshes nothing', async () => {
      const expiresInMs = 3600 * 1000
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()
      mockCurrentUser.value = null
      expect(
        unifiedToken.value,
        'the port delivering sign-out is the fail-closed path for identity, not the host teardown'
      ).toBeNull()

      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('does not toast on a successful refresh re-mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)

      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('does not toast on a transient refresh failure and keeps the slot', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      // A transient backend failure must not alarm the user or wipe the slot.
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'try again' }), {
            status: 500,
            statusText: 'Internal Server Error'
          })
      )
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      const refreshDelay = expiresInMs - 5 * 60 * 1000
      await vi.advanceTimersByTimeAsync(refreshDelay)

      expect(useToast().error).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBe('unified-token-1')
    })

    it('retries a transiently failed proactive refresh with backoff and rotates on success', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      const okResponse = () =>
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      vi.mocked(fetch)
        .mockResolvedValueOnce(okResponse())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'try again' }), {
            status: 500,
            statusText: 'Internal Server Error'
          })
        )
        .mockImplementation(() => Promise.resolve(okResponse()))

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      const refreshDelay = expiresInMs - 5 * 60 * 1000
      await vi.advanceTimersByTimeAsync(refreshDelay)
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(useAuthStore().notifyTokenRefreshed).not.toHaveBeenCalled()
      expect(useTelemetry()?.trackUnifiedAuthRefresh).toHaveBeenLastCalledWith({
        outcome: 'retry_scheduled',
        retry_count: 1
      })

      await vi.advanceTimersByTimeAsync(5000)

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(useAuthStore().notifyTokenRefreshed).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackUnifiedAuthRefresh).toHaveBeenLastCalledWith({
        outcome: 'succeeded'
      })
      expect(unifiedToken.value).toBe('unified-token-1')

      // The successful retry re-arms the normal proactive schedule.
      await vi.advanceTimersByTimeAsync(refreshDelay)
      expect(fetch).toHaveBeenCalledTimes(4)
    })

    it('starts a fresh retry_count after a successful reactive re-mint', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      const okResponse = (token: string) =>
        Response.json({
          ...personalTokenResponse,
          token,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      const transientFailure = () =>
        new Response(JSON.stringify({ message: 'try again' }), {
          status: 500,
          statusText: 'Internal Server Error'
        })
      respondToFetch(TOKEN_URL, transientFailure)
      vi.mocked(fetch)
        .mockResolvedValueOnce(okResponse('unified-token-1'))
        .mockResolvedValueOnce(transientFailure())
        .mockImplementationOnce(() =>
          Promise.resolve(okResponse('unified-token-2'))
        )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)
      expect(useTelemetry()?.trackUnifiedAuthRefresh).toHaveBeenLastCalledWith({
        outcome: 'retry_scheduled',
        retry_count: 1
      })

      await expect(store.remintUnifiedOnce('unified-token-1')).resolves.toBe(
        'unified-token-2'
      )
      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)

      expect(
        useTelemetry()?.trackUnifiedAuthRefresh,
        'a successful mint starts a fresh retry chain; a stale count here poisons the exhaustion signal'
      ).toHaveBeenLastCalledWith({
        outcome: 'retry_scheduled',
        retry_count: 1
      })
    })

    it('bounds refresh retries, keeps the slot until expiry, then ends the session', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'try again' }), {
            status: 500,
            statusText: 'Internal Server Error'
          })
      )
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(10000)
      await vi.advanceTimersByTimeAsync(20000)
      expect(fetch).toHaveBeenCalledTimes(5)

      expect(useTelemetry()?.trackUnifiedAuthRefresh).toHaveBeenLastCalledWith({
        outcome: 'retries_exhausted',
        retry_count: 3
      })
      // A RUM action cannot raise a Sentry alert, so the moment the cookie
      // rail dies must also reach the error tracker (FE-1595).
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          surface: 'auth',
          errorType: 'failure_refreshing_unified_auth_retries_exhausted',
          tags: expect.objectContaining({ retry_count: 3 })
        })
      )
      expect(
        unifiedToken.value,
        'a still-valid token keeps serving while there is time on it'
      ).toBe('unified-token-1')

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(fetch).toHaveBeenCalledTimes(5)
      expect(useToast().error).not.toHaveBeenCalled()
      expect(useTelemetry()?.trackUnifiedAuthRefresh).toHaveBeenLastCalledWith({
        outcome: 'expired',
        retry_count: 3
      })
      expect(
        unifiedToken.value,
        'the legacy rail ends the session at expiry; an expired JWT must not stay in circulation'
      ).toBeNull()
      expect(mockReload).toHaveBeenCalled()
    })

    it('gives up on a login mint when the port never delivers the current user', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () => Response.json(personalTokenResponse))

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      mockCurrentUser.deliver(null)
      expect(store.unifiedToken).toBeNull()

      const pending = store.mintAtLogin()
      await vi.advanceTimersByTimeAsync(UNIFIED_IDENTITY_SETTLE_TIMEOUT_MS)

      expect(
        await pending,
        'a silent port must fail the mint closed, not hang the auth gate'
      ).toBe(false)
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('exhausts the scheduled retries when the identity token read keeps failing, keeping the still-valid token', async () => {
      vi.mocked(useAuthStore().getIdToken)
        .mockResolvedValueOnce('firebase-token-xyz')
        .mockRejectedValue(new Error('auth/user-token-expired'))
      const expiresInMs = 3600 * 1000
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...personalTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)
      await store.mintAtLogin()

      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)
      await vi.advanceTimersByTimeAsync(5000 + 10_000 + 20_000)

      expect(useTelemetry()?.trackUnifiedAuthRefresh).toHaveBeenLastCalledWith({
        outcome: 'retries_exhausted',
        retry_count: 3
      })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(useToast().error).not.toHaveBeenCalled()
      expect(
        unifiedToken.value,
        'a token read failure is not a revocation; the token serves until it expires'
      ).toBe('unified-token-1')

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(useTelemetry()?.trackUnifiedAuthRefresh).toHaveBeenLastCalledWith({
        outcome: 'expired',
        retry_count: 3
      })
      expect(
        unifiedToken.value,
        'an expired token with a dead refresh chain must not stay in circulation'
      ).toBeNull()
      expect(
        mockReload,
        'the session ends at expiry, as the legacy rail does'
      ).toHaveBeenCalled()
    })

    it('re-arms the retry when the identity token read fails transiently mid-refresh', async () => {
      vi.mocked(useAuthStore().getIdToken)
        .mockResolvedValueOnce('firebase-token-xyz')
        .mockRejectedValueOnce(new Error('Firebase re-initializing'))
        .mockResolvedValue('firebase-token-xyz')
      const expiresInMs = 3600 * 1000
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          Response.json({
            ...personalTokenResponse,
            expires_at: new Date(Date.now() + expiresInMs).toISOString()
          })
        )
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()
      expect(fetch).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(useToast().error).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(5000)

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(useAuthStore().notifyTokenRefreshed).toHaveBeenCalledTimes(1)
      expect(unifiedToken.value).toBe('unified-token-1')
    })

    it('does not stomp a superseding workspace switch schedule with a stale-refresh retry', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      const okResponse = (token: string, init: RequestInit | undefined) => {
        const workspaceId =
          (JSON.parse(String(init?.body ?? '{}')) as { workspace_id?: string })
            .workspace_id ?? mockWorkspace.id
        return Response.json({
          ...mockTokenResponse,
          token,
          workspace: { ...mockWorkspace, id: workspaceId },
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      }
      let releaseStaleRefresh = () => {}
      const staleRefreshGate = new Promise<void>((resolve) => {
        releaseStaleRefresh = resolve
      })
      vi.mocked(fetch)
        .mockImplementationOnce((_url, init) =>
          Promise.resolve(okResponse('workspace-token-a', init))
        )
        .mockImplementationOnce((_url, init) =>
          staleRefreshGate.then(() => okResponse('stale-refresh-token', init))
        )
        .mockImplementation((_url, init) =>
          Promise.resolve(okResponse('workspace-token-b', init))
        )

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-a')

      // The proactive refresh fires and hangs; a workspace switch supersedes
      // it and arms its own schedule before the stale mint resolves false.
      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)
      const switchPromise = store.switchWorkspace('workspace-b')
      releaseStaleRefresh()
      await switchPromise
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getUnifiedToken()).toBe('workspace-token-b')

      // No 5s retry pending: the next mint is workspace-b's own scheduled
      // refresh, not a stale-refresh backoff retry.
      const fetchCallsAfterSwitch = vi.mocked(fetch).mock.calls.length
      await vi.advanceTimersByTimeAsync(5000)
      expect(fetch).toHaveBeenCalledTimes(fetchCallsAfterSwitch)
    })

    it('surfaces an error toast and resolves false when the login mint hits a permanent auth error', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(
        TOKEN_URL,
        () =>
          new Response(JSON.stringify({ message: 'Invalid token' }), {
            status: 401,
            statusText: 'Unauthorized'
          })
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      const result = await store.mintAtLogin()

      expect(result).toBe(false)
      expect(unifiedToken.value).toBeNull()
      expect(useToast().error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          description: 'workspaceAuth.errors.invalidFirebaseToken'
        })
      )
    })

    it('never toasts from the unified lifecycle when the flag is OFF', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = false
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      // Even with a backend that would reject, the OFF lifecycle stays inert.
      vi.mocked(fetch).mockImplementation(async () =>
        Response.json(
          { message: 'Access denied' },
          { status: 403, statusText: 'Forbidden' }
        )
      )

      const store = useWorkspaceAuthStore()

      await store.mintAtLogin()
      await store.remintUnifiedOnce('unified-token-1')
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(useToast().error).not.toHaveBeenCalled()
    })
  })

  describe('legacy rail seam', () => {
    it('routes the legacy refresh deadline through the flag dispatcher once unified auth turns on', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...mockTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { workspaceToken } = storeToRefs(store)
      await store.switchWorkspace('workspace-123')
      expect(workspaceToken.value).toBe('workspace-token-abc')

      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      vi.advanceTimersByTime(expiresInMs - TOKEN_REFRESH_BUFFER_MS)

      await vi.waitFor(() => {
        expect(store.getUnifiedMintWorkspaceId()).toBe('workspace-123')
        expect(store.getUnifiedToken()).toBe('workspace-token-abc')
      })
      expect(workspaceToken.value).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
    })

    it('routes an expired-token recovery through the flag dispatcher and fails closed on the legacy rail', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      const expiresInMs = 3600 * 1000
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...mockTokenResponse,
          expires_at: new Date(Date.now() + expiresInMs).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { workspaceToken } = storeToRefs(store)
      await store.switchWorkspace('workspace-123')
      expect(workspaceToken.value).toBe('workspace-token-abc')

      vi.setSystemTime(Date.now() + expiresInMs + 1)
      vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
      const recovered = store.ensureWorkspaceToken('workspace-123')

      await expect(recovered).resolves.toBeNull()
      expect(store.getUnifiedMintWorkspaceId()).toBe('workspace-123')
      expect(store.getUnifiedToken()).toBe('workspace-token-abc')
      expect(workspaceToken.value).toBeNull()
    })

    it('returns null rather than a token for a different workspace when the requested one cannot be entered', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...mockTokenResponse,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      const { workspaceToken, currentWorkspace } = storeToRefs(store)

      const token = await store.ensureWorkspaceToken('workspace-456')

      expect(token).toBeNull()
      expect(currentWorkspace.value?.id).toBe('workspace-123')
      expect(workspaceToken.value).toBe('workspace-token-abc')
      expect(fetch).toHaveBeenCalledOnce()

      await expect(
        store.ensureWorkspaceToken('workspace-456')
      ).resolves.toBeNull()
      expect(fetch).toHaveBeenCalledOnce()
    })

    it('resolves the identity token at mint time, not at store construction', async () => {
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-token-1')
      respondToFetch(TOKEN_URL, () => Response.json(mockTokenResponse))

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')
      Object.assign(useAuthStore(), {
        getIdToken: vi.fn().mockResolvedValue('firebase-token-2')
      })
      await store.switchWorkspace('workspace-123')

      expect(
        fetchRequests(TOKEN_URL).map(({ headers }) =>
          headers.get('Authorization')
        )
      ).toEqual(['Bearer firebase-token-1', 'Bearer firebase-token-2'])
    })

    it('reads the active local workspace at recovery time, not at store construction', async () => {
      mockDistributionTypes.isCloud = false
      vi.mocked(useAuthStore().getIdToken).mockResolvedValue(
        'firebase-token-xyz'
      )
      respondToFetch(TOKEN_URL, () =>
        Response.json({
          ...mockTokenResponse,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
        })
      )

      const store = useWorkspaceAuthStore()
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-123'
      })

      await expect(store.ensureWorkspaceToken('workspace-123')).resolves.toBe(
        'workspace-token-abc'
      )
      expect(fetch).toHaveBeenCalledOnce()
    })
  })
})

describe('useWorkspaceAuthStore constructed before authStore', () => {
  it('mints for the port user when the store subscribes before authStore exists', async () => {
    mockDistributionTypes.isCloud = true
    vi.mocked(useFeatureFlags().flags).unifiedCloudAuthEnabled = true
    const user = fromPartial<User>({
      uid: 'user-a',
      getIdToken: async () => 'firebase-token-xyz'
    })
    vi.spyOn(firebaseIdentity, 'onUserChanged').mockImplementation(
      (listener) => {
        listener(user)
        return () => {}
      }
    )
    respondToFetch(TOKEN_URL, () =>
      Response.json({
        token: 'unified-token-1',
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        workspace: {
          id: 'workspace-personal',
          name: 'Personal',
          type: 'personal' as const
        },
        role: 'owner' as const,
        permissions: ['owner:*']
      })
    )

    const store = useWorkspaceAuthStore()
    const { unifiedToken } = storeToRefs(store)

    const result = await store.mintAtLogin()

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      TOKEN_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer firebase-token-xyz'
        })
      })
    )
    expect(unifiedToken.value).toBe('unified-token-1')
  })
})
