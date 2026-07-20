import { createPinia, setActivePinia, storeToRefs } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useWorkspaceAuthStore,
  WorkspaceAuthError
} from '@/platform/workspace/stores/workspaceAuthStore'

import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

const mockGetIdToken = vi.fn()
const mockNotifyTokenRefreshed = vi.fn()
const mockToastAdd = vi.fn()
const mockEnsureSessionCookie = vi.fn()
const mockCurrentUser = vi.hoisted((): { value: { uid: string } | null } => ({
  value: null
}))
const mockForgetRevokedActiveWorkspace = vi.fn()

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getIdToken: mockGetIdToken,
    notifyTokenRefreshed: mockNotifyTokenRefreshed,
    get currentUser() {
      return mockCurrentUser.value
    }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    forgetRevokedActiveWorkspace: mockForgetRevokedActiveWorkspace
  })
}))

vi.mock('@/platform/auth/session/useSessionCookie', () => ({
  useSessionCookie: () => ({
    ensureSessionCookie: mockEnsureSessionCookie
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mockToastAdd
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (route: string) => `https://api.example.com/api${route}`
  }
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

const mockTeamWorkspacesEnabled = vi.hoisted(() => ({ value: true }))
const mockUnifiedCloudAuthEnabled = vi.hoisted(() => ({ value: false }))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get teamWorkspacesEnabled() {
        return mockTeamWorkspacesEnabled.value
      },
      get unifiedCloudAuthEnabled() {
        return mockUnifiedCloudAuthEnabled.value
      }
    }
  })
}))

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
  expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  workspace: mockWorkspace,
  role: 'owner' as const,
  permissions: ['owner:*']
}

function expectedExpiresAtMs(expiresAt: string): string {
  return new Date(expiresAt).getTime().toString()
}

describe('useWorkspaceAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    sessionStorage.clear()
    mockTeamWorkspacesEnabled.value = true
    mockUnifiedCloudAuthEnabled.value = false
    mockCurrentUser.value = { uid: 'user-a' }
    mockEnsureSessionCookie.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const switchPromise = store.switchWorkspace('workspace-123')
      await Promise.resolve()

      expect(mockFetch).not.toHaveBeenCalled()

      confirmSession()
      await switchPromise

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(store.workspaceToken).toBe('workspace-token-abc')
    })

    it('does not exchange a workspace token when session creation fails', async () => {
      mockEnsureSessionCookie.mockRejectedValue(new Error('session denied'))
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        'session denied'
      )
      expect(mockFetch).not.toHaveBeenCalled()
      expect(store.workspaceToken).toBeNull()
    })

    it('discards a token exchange that resolves after the user changes', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-a')
      let resolveResponse: (value: unknown) => void = () => {}
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveResponse = resolve
          })
        )
      )

      const store = useWorkspaceAuthStore()
      const switchPromise = store.switchWorkspace('workspace-123')
      mockCurrentUser.value = { uid: 'user-b' }
      resolveResponse({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })

      await switchPromise

      expect(store.workspaceToken).toBeNull()
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBeNull()
    })

    it('stores workspace data in sessionStorage', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
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

    it('sets isLoading to true during operation', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      let resolveResponse: (value: unknown) => void
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve
      })
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(responsePromise))

      const store = useWorkspaceAuthStore()
      const { isLoading } = storeToRefs(store)

      const switchPromise = store.switchWorkspace('workspace-123')
      expect(isLoading.value).toBe(true)

      resolveResponse!({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      await switchPromise

      expect(isLoading.value).toBe(false)
    })

    it('keeps isLoading true until overlapping switches settle', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      let resolveFirstSwitch: (value: unknown) => void = () => {}
      let resolveSecondSwitch: (value: unknown) => void = () => {}
      const firstSwitchResponse = new Promise((resolve) => {
        resolveFirstSwitch = resolve
      })
      const secondSwitchResponse = new Promise((resolve) => {
        resolveSecondSwitch = resolve
      })
      const mockFetch = vi
        .fn()
        .mockReturnValueOnce(firstSwitchResponse)
        .mockReturnValueOnce(secondSwitchResponse)
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { isLoading } = storeToRefs(store)

      const firstSwitch = store.switchWorkspace('workspace-123')
      const secondSwitch = store.switchWorkspace('workspace-other')

      expect(isLoading.value).toBe(true)

      resolveFirstSwitch({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      await firstSwitch

      expect(isLoading.value).toBe(true)

      resolveSecondSwitch({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            workspace: { ...mockWorkspace, id: 'workspace-other' }
          })
      })
      await secondSwitch

      expect(isLoading.value).toBe(false)
    })

    it('throws WorkspaceAuthError with code NOT_AUTHENTICATED when Firebase token unavailable', async () => {
      mockGetIdToken.mockResolvedValue(undefined)

      const store = useWorkspaceAuthStore()
      const { error } = storeToRefs(store)

      await expect(store.switchWorkspace('workspace-123')).rejects.toThrow(
        WorkspaceAuthError
      )

      expect(error.value).toBeInstanceOf(WorkspaceAuthError)
      expect((error.value as WorkspaceAuthError).code).toBe('NOT_AUTHENTICATED')
    })

    it('throws WorkspaceAuthError with code ACCESS_DENIED on 403 response', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Access denied' })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ message: 'Workspace not found' })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ message: 'Invalid token' })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ message: 'Server error' })
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
    })

    it('sends correct request to API', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/token',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer firebase-token-xyz',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ workspace_id: 'workspace-123' })
        }
      )
    })
  })

  describe('clearWorkspaceContext', () => {
    it('clears all state refs', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, isAuthenticated, error } =
        storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(isAuthenticated.value).toBe(true)

      let resolveRefreshFetch: (value: unknown) => void = () => {}
      const refreshFetchPromise = new Promise((resolve) => {
        resolveRefreshFetch = resolve
      })
      mockFetch.mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      store.clearWorkspaceContext()

      resolveRefreshFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'restored-token'
          })
      })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('re-mints instead of returning a token owned by another user', async () => {
      mockGetIdToken
        .mockResolvedValueOnce('firebase-token-a')
        .mockResolvedValueOnce('firebase-token-b')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockTokenResponse,
              token: 'workspace-token-b'
            })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')
      mockCurrentUser.value = { uid: 'user-b' }

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-b' })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('mints a token for the preferred workspace when none exists', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      )

      const store = useWorkspaceAuthStore()

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-abc' })
    })

    it('coalesces concurrent recovery onto a single mint', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      const [first, second] = await Promise.all([
        store.ensureWorkspaceAuthHeader('workspace-123'),
        store.ensureWorkspaceAuthHeader('workspace-123')
      ])

      expect(first).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(second).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('awaits an in-flight switch instead of racing a second mint', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      let resolveResponse: (value: unknown) => void = () => {}
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve
      })
      const mockFetch = vi.fn().mockReturnValue(responsePromise)
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      const switchPromise = store.switchWorkspace('workspace-123')
      const ensurePromise = store.ensureWorkspaceAuthHeader('workspace-123')

      resolveResponse({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      await switchPromise
      const header = await ensurePromise

      expect(header).toEqual({ Authorization: 'Bearer workspace-token-abc' })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('does not give a previous user waiter the next user token', async () => {
      mockGetIdToken.mockImplementation(() =>
        Promise.resolve(`firebase-${mockCurrentUser.value?.uid}`)
      )
      let resolvePreviousResponse: (value: unknown) => void = () => {}
      const mockFetch = vi
        .fn()
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolvePreviousResponse = resolve
          })
        )
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockTokenResponse,
              token: 'workspace-token-b'
            })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const previousHeader = store.ensureWorkspaceAuthHeader('workspace-123')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

      mockCurrentUser.value = { uid: 'user-b' }
      store.clearWorkspaceContext()
      await store.switchWorkspace('workspace-123')

      resolvePreviousResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'workspace-token-a'
          })
      })

      await expect(previousHeader).resolves.toBeNull()
      expect(store.workspaceToken).toBe('workspace-token-b')
      expect(store.currentWorkspace?.id).toBe('workspace-123')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('returns null (never a downgrade) when recovery fails transiently', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({})
        })
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

    it('is a no-op returning null when the feature flag is disabled', async () => {
      mockTeamWorkspacesEnabled.value = false
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      const header = await store.ensureWorkspaceAuthHeader('workspace-123')

      expect(header).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('tears down workspace context and surfaces a toast on a permanent recovery failure', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
        .mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Access denied' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace } = storeToRefs(store)
      await store.switchWorkspace('workspace-123')

      const token = await store.ensureWorkspaceToken('workspace-999')

      expect(token).toBeNull()
      expect(currentWorkspace.value).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledTimes(1)
    })

    it('backs off re-minting after a failed recovery instead of retrying every call', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({})
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      const first = await store.ensureWorkspaceToken('workspace-123')
      const second = await store.ensureWorkspaceToken('workspace-123')

      expect(first).toBeNull()
      expect(second).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('forgets the revoked active workspace on a permanent workspace-selection failure', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Access denied' })
        })
      )

      const store = useWorkspaceAuthStore()

      const token = await store.ensureWorkspaceToken('workspace-123')

      expect(token).toBeNull()
      expect(mockForgetRevokedActiveWorkspace).toHaveBeenCalledWith(
        'workspace-123'
      )
    })

    it('does not forget the workspace when the failure is an auth error, not revocation', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ message: 'Invalid token' })
        })
      )

      const store = useWorkspaceAuthStore()

      const token = await store.ensureWorkspaceToken('workspace-123')

      expect(token).toBeNull()
      expect(mockForgetRevokedActiveWorkspace).not.toHaveBeenCalled()
    })

    it('preserves a valid context on a transient Firebase network failure while signed in', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      )

      const store = useWorkspaceAuthStore()
      const { currentWorkspace } = storeToRefs(store)
      await store.switchWorkspace('workspace-123')

      mockCurrentUser.value = { uid: 'user-a' }
      mockGetIdToken.mockResolvedValue(undefined)

      const token = await store.ensureWorkspaceToken('workspace-999')

      expect(token).toBeNull()
      expect(currentWorkspace.value?.id).toBe('workspace-123')
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockForgetRevokedActiveWorkspace).not.toHaveBeenCalled()
    })

    it('collapses a burst of waiters into a single mint after a shared in-flight switch rejects', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({})
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      vi.stubGlobal('fetch', mockFetch)

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
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('re-mints for the requested workspace rather than returning an in-flight switch to a different one', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockImplementation((_url, options) => {
        const { workspace_id: workspaceId } = JSON.parse(options.body)
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockTokenResponse,
              token: `token-${workspaceId}`,
              workspace: { ...mockWorkspace, id: workspaceId }
            })
        })
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      const switchPromise = store.switchWorkspace('workspace-other')
      const token = await store.ensureWorkspaceToken('workspace-123')
      await switchPromise

      expect(token).toBe('token-workspace-123')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('token refresh scheduling', () => {
    it('schedules token refresh 5 minutes before expiry', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const expiresInMs = 3600 * 1000
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(Date.now() + expiresInMs).toISOString()
      }
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(tokenResponseWithFutureExpiry)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-123')

      expect(mockFetch).toHaveBeenCalledTimes(1)

      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs

      vi.advanceTimersByTime(refreshDelay - 1)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1)

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('clears context when refresh fails with ACCESS_DENIED', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const expiresInMs = 3600 * 1000
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(Date.now() + expiresInMs).toISOString()
      }
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(tokenResponseWithFutureExpiry)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Access denied' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(workspaceToken.value).toBe('workspace-token-abc')

      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs

      vi.advanceTimersByTime(refreshDelay)
      await vi.waitFor(() => {
        expect(currentWorkspace.value).toBeNull()
      })

      expect(workspaceToken.value).toBeNull()
    })
  })

  describe('refreshToken', () => {
    it('does nothing when no current workspace', async () => {
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      await store.refreshToken()

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('refreshes token for current workspace', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'refreshed-token'
          })
      })

      await store.refreshToken()
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(workspaceToken.value).toBe('refreshed-token')
    })
  })

  describe('isAuthenticated computed', () => {
    it('returns true when both workspace and token are present', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
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
      mockGetIdToken.mockResolvedValue(null)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, isAuthenticated } =
        storeToRefs(store)

      currentWorkspace.value = mockWorkspaceWithRole
      workspaceToken.value = null

      expect(isAuthenticated.value).toBe(false)
    })
  })

  describe('feature flag disabled', () => {
    beforeEach(() => {
      mockTeamWorkspacesEnabled.value = false
    })

    afterEach(() => {
      mockTeamWorkspacesEnabled.value = true
    })

    it('initializeFromSession returns false when flag disabled', () => {
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

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      const result = store.initializeFromSession()

      expect(result).toBe(false)
      expect(currentWorkspace.value).toBeNull()
      expect(workspaceToken.value).toBeNull()
    })

    it('switchWorkspace is a no-op when flag disabled', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, isLoading } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      expect(mockFetch).not.toHaveBeenCalled()
      expect(currentWorkspace.value).toBeNull()
      expect(workspaceToken.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })
  })

  describe('refreshToken retry/race paths', () => {
    it('retries up to 3 times with exponential backoff on TOKEN_EXCHANGE_FAILED, then preserves valid context', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')

      // Initial successful switchWorkspace establishes context.
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, error } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('workspace-token-abc')

      // Subsequent refresh attempts all fail with 500 (TOKEN_EXCHANGE_FAILED).
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Server error' })
      })

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      const refreshPromise = store.refreshToken()

      // Drain only the retry backoff delays; do not advance to the scheduled
      // proactive refresh timer for the still-valid token.
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await refreshPromise

      // 1 initial switchWorkspace + 4 refresh attempts = 5 total fetch calls.
      expect(mockFetch).toHaveBeenCalledTimes(5)
      // Backoff: 1s + 2s + 4s = 7s of cumulative warn-logged delays.
      expect(
        consoleWarnSpy.mock.calls.some((c) =>
          /retrying in 1000ms/.test(String(c[0]))
        )
      ).toBe(true)
      expect(
        consoleWarnSpy.mock.calls.some((c) =>
          /retrying in 2000ms/.test(String(c[0]))
        )
      ).toBe(true)
      expect(
        consoleWarnSpy.mock.calls.some((c) =>
          /retrying in 4000ms/.test(String(c[0]))
        )
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
      expect(consoleErrorSpy).not.toHaveBeenCalled()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockTokenResponse, token: 'retry-token' })
      })

      // Retry is scheduled at baseDelayMs * 2^maxRetries = 8000ms.
      await vi.advanceTimersByTimeAsync(7999)
      expect(mockFetch).toHaveBeenCalledTimes(5)

      await vi.advanceTimersByTimeAsync(1)
      expect(mockFetch).toHaveBeenCalledTimes(6)
      await vi.waitFor(() => {
        expect(workspaceToken.value).toBe('retry-token')
      })

      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('clears context immediately on INVALID_FIREBASE_TOKEN without retrying', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')
      expect(currentWorkspace.value).not.toBeNull()

      // Permanent error: 401 → INVALID_FIREBASE_TOKEN.
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid token' })
      })

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await store.refreshToken()

      // Initial + exactly one refresh attempt; no retries on permanent errors.
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(currentWorkspace.value).toBeNull()

      consoleErrorSpy.mockRestore()
    })

    it('keeps the old workspace refresh when a newer workspace switch fails', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      let resolveRefreshFetch: (value: unknown) => void = () => {}
      const refreshFetchPromise = new Promise((resolve) => {
        resolveRefreshFetch = resolve
      })
      mockFetch.mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ message: 'Access denied' })
      })
      await expect(store.switchWorkspace('workspace-other')).rejects.toThrow(
        WorkspaceAuthError
      )

      const refreshedExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      resolveRefreshFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'refreshed-workspace-token',
            expires_at: refreshedExpiry
          })
      })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      let resolveRefreshFetch: (value: unknown) => void = () => {}
      const refreshFetchPromise = new Promise((resolve) => {
        resolveRefreshFetch = resolve
      })
      mockFetch.mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      const sameWorkspaceExpiry = new Date(
        Date.now() + 7200 * 1000
      ).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'same-workspace-token',
            expires_at: sameWorkspaceExpiry
          })
      })
      await store.switchWorkspace('workspace-123')

      expect(currentWorkspace.value).toEqual(mockWorkspaceWithRole)
      expect(workspaceToken.value).toBe('same-workspace-token')

      const refreshedExpiry = new Date(Date.now() + 9000 * 1000).toISOString()
      resolveRefreshFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'refreshed-workspace-token',
            expires_at: refreshedExpiry
          })
      })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      // Hang the next fetch — this is the refresh's switchWorkspace fetch.
      let resolveRefreshFetch: (value: unknown) => void = () => {}
      const refreshFetchPromise = new Promise((resolve) => {
        resolveRefreshFetch = resolve
      })
      mockFetch.mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      // User switches workspace AND its fetch resolves first.
      const newWorkspace = { ...mockWorkspace, id: 'workspace-other' }
      const newExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'new-workspace-token',
            expires_at: newExpiry,
            workspace: newWorkspace
          })
      })
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
      resolveRefreshFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'stale-token',
            expires_at: staleExpiry
          })
      })
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
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      // Hang the refresh fetch so it resolves after both switches below.
      let resolveRefreshFetch: (value: unknown) => void = () => {}
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRefreshFetch = resolve
        })
      )
      const refreshPromise = store.refreshToken()

      // Switch away to a different workspace...
      const otherExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'other-workspace-token',
            expires_at: otherExpiry,
            workspace: { ...mockTokenResponse.workspace, id: 'workspace-other' }
          })
      })
      await store.switchWorkspace('workspace-other')
      expect(workspaceToken.value).toBe('other-workspace-token')

      // ...and back to the original workspace.
      const backExpiry = new Date(Date.now() + 7200 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'back-workspace-token',
            expires_at: backExpiry
          })
      })
      await store.switchWorkspace('workspace-123')
      expect(workspaceToken.value).toBe('back-workspace-token')

      // Stale refresh resolves with an old token — must not clobber state.
      resolveRefreshFetch({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockTokenResponse, token: 'stale-token' })
      })
      await refreshPromise

      expect(currentWorkspace.value?.id).toBe('workspace-123')
      expect(workspaceToken.value).toBe('back-workspace-token')
      expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)).toBe(
        'back-workspace-token'
      )
    })

    it('the new workspace keeps clean error state when a stale refresh fails last', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { currentWorkspace, workspaceToken, error } = storeToRefs(store)

      await store.switchWorkspace('workspace-123')

      let resolveRefreshFetch: (value: unknown) => void = () => {}
      const refreshFetchPromise = new Promise((resolve) => {
        resolveRefreshFetch = resolve
      })
      mockFetch.mockReturnValueOnce(refreshFetchPromise)

      const refreshPromise = store.refreshToken()

      const newWorkspace = { ...mockWorkspace, id: 'workspace-other' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockTokenResponse,
            token: 'new-workspace-token',
            workspace: newWorkspace
          })
      })
      await store.switchWorkspace('workspace-other')

      resolveRefreshFetch({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Server error' })
      })
      await refreshPromise

      expect(currentWorkspace.value?.id).toBe('workspace-other')
      expect(workspaceToken.value).toBe('new-workspace-token')
      expect(error.value).toBeNull()
    })
  })

  describe('persistToSession resilience', () => {
    it('updates store state even when sessionStorage.setItem throws', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
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
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      try {
        const store = useWorkspaceAuthStore()
        const { workspaceToken } = storeToRefs(store)

        await store.switchWorkspace('workspace-123')

        expect(workspaceToken.value).toBe('workspace-token-abc')
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to persist workspace context to sessionStorage'
        )
      } finally {
        vi.stubGlobal('sessionStorage', originalSessionStorage)
        consoleWarnSpy.mockRestore()
      }
    })
  })

  describe('Zod validation on token response', () => {
    it('throws TOKEN_EXCHANGE_FAILED when the response is missing required fields', async () => {
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              token: 'token-only',
              // missing expires_at, workspace, role, permissions
              role: 'owner'
            })
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

    it('mintAtLogin is a no-op and returns false when the flag is OFF', async () => {
      mockUnifiedCloudAuthEnabled.value = false
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      const result = await store.mintAtLogin()

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBeNull()
    })

    it('mints the personal default once into the dormant unifiedToken slot when flag ON', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(personalTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken, workspaceToken } = storeToRefs(store)

      const result = await store.mintAtLogin()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      // Personal default mints with an id-less empty body.
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({})
        })
      )
      expect(unifiedToken.value).toBe('unified-token-1')
      // Dormant slot proof: the legacy workspace token is never written.
      expect(workspaceToken.value).toBeNull()
    })

    it('does not re-mint when unifiedToken is already populated', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(personalTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      await store.mintAtLogin()
      const result = await store.mintAtLogin()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('re-mints when the existing unified token belongs to another user', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken
        .mockResolvedValueOnce('firebase-token-a')
        .mockResolvedValueOnce('firebase-token-b')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(personalTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ ...personalTokenResponse, token: 'unified-b' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      mockCurrentUser.value = { uid: 'user-b' }

      const result = await store.mintAtLogin()

      expect(result).toBe(true)
      expect(store.unifiedToken).toBe('unified-b')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('arms a refresh at expires_at - buffer and re-mints from the parsed expiry (no hardcoded TTL)', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const expiresInMs = 3600 * 1000
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ...personalTokenResponse,
            expires_at: new Date(Date.now() + expiresInMs).toISOString()
          })
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      await store.mintAtLogin()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const refreshDelay = expiresInMs - 5 * 60 * 1000

      vi.advanceTimersByTime(refreshDelay - 1)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('does not bump the rotation trigger on the initial login mint', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(personalTokenResponse)
        })
      )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()

      expect(mockNotifyTokenRefreshed).not.toHaveBeenCalled()
    })

    it('does not bump the rotation trigger on a workspace switch', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      )

      const store = useWorkspaceAuthStore()
      await store.switchWorkspace('workspace-123')

      expect(mockNotifyTokenRefreshed).not.toHaveBeenCalled()
    })

    it('bumps the rotation trigger exactly once on a refresh re-mint', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const expiresInMs = 3600 * 1000
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...personalTokenResponse,
              expires_at: new Date(Date.now() + expiresInMs).toISOString()
            })
        })
      )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()

      const refreshDelay = expiresInMs - 5 * 60 * 1000
      await vi.advanceTimersByTimeAsync(refreshDelay)

      expect(mockNotifyTokenRefreshed).toHaveBeenCalledTimes(1)
    })

    it('remintUnifiedOnce re-mints once and, on a permanent failure, surfaces it and tears down without looping', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(personalTokenResponse)
        })
        .mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ message: 'Invalid token' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)
      await store.mintAtLogin()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const result = await store.remintUnifiedOnce('unified-token-1')

      // Exactly one re-mint attempt — the primitive does not retry.
      expect(mockFetch).toHaveBeenCalledTimes(2)
      // A permanent failure resolves to null (the caller surfaces its 401),
      // fires the error toast keyed to the 401 code, and clears the dead session.
      expect(result).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'workspaceAuth.errors.invalidFirebaseToken'
        })
      )
      expect(unifiedToken.value).toBeNull()
    })

    it('remintUnifiedOnce does not toast or clear the slot on a transient re-mint failure', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(personalTokenResponse)
        })
        // A transient backend failure must not alarm the user or wipe the slot.
        .mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ message: 'try again' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      const result = await store.remintUnifiedOnce('unified-token-1')

      expect(result).toBeNull()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBe('unified-token-1')
    })

    it('remintUnifiedOnce returns null without minting when the flag is OFF', async () => {
      mockUnifiedCloudAuthEnabled.value = false
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      const result = await store.remintUnifiedOnce('unified-token-1')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('does not retry an old account request with the current account token', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken
        .mockResolvedValueOnce('firebase-token-a')
        .mockResolvedValueOnce('firebase-token-b')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(personalTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ ...personalTokenResponse, token: 'unified-b' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      mockCurrentUser.value = { uid: 'user-b' }
      await store.mintAtLogin()

      const result = await store.remintUnifiedOnce('unified-token-1')

      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('ignores a stale unified mint failure after account state is cleared', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-a')
      let resolveResponse: (value: unknown) => void = () => {}
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveResponse = resolve
          })
        )
      )

      const store = useWorkspaceAuthStore()
      const mintPromise = store.mintAtLogin()
      store.clearWorkspaceContext()
      resolveResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'old account' })
      })

      await expect(mintPromise).resolves.toBe(false)
      expect(store.unifiedToken).toBeNull()
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('coalesces concurrent re-mints and returns the winning token to every caller', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(personalTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      let resolveRemint: (value: unknown) => void = () => {}
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRemint = resolve
        })
      )
      const first = store.remintUnifiedOnce('unified-token-1')
      const second = store.remintUnifiedOnce('unified-token-1')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))

      resolveRemint({
        ok: true,
        json: () =>
          Promise.resolve({ ...personalTokenResponse, token: 'latest-token' })
      })

      await expect(Promise.all([first, second])).resolves.toEqual([
        'latest-token',
        'latest-token'
      ])
      expect(unifiedToken.value).toBe('latest-token')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('reuses a same-user burst winner for a later stale 401', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(personalTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ ...personalTokenResponse, token: 'winner-token' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()

      expect(await store.remintUnifiedOnce('unified-token-1')).toBe(
        'winner-token'
      )
      expect(await store.remintUnifiedOnce('unified-token-1')).toBe(
        'winner-token'
      )
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('clears unifiedToken and stops the unified timer on clearWorkspaceContext', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(personalTokenResponse)
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()
      expect(unifiedToken.value).toBe('unified-token-1')

      store.clearWorkspaceContext()
      expect(unifiedToken.value).toBeNull()

      // Timer stopped: advancing past the refresh window triggers no re-mint.
      mockFetch.mockClear()
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('is fully dormant under the flag OFF: no unified network, timer, or rotation', async () => {
      mockUnifiedCloudAuthEnabled.value = false
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()
      await store.remintUnifiedOnce('unified-token-1')
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(mockFetch).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBeNull()
      expect(mockNotifyTokenRefreshed).not.toHaveBeenCalled()
    })

    it('keeps the legacy refresh path gated: both flags OFF ⇒ no network from any timer', async () => {
      mockTeamWorkspacesEnabled.value = false
      mockUnifiedCloudAuthEnabled.value = false
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()

      await store.switchWorkspace('workspace-123')
      await store.mintAtLogin()
      await store.refreshToken()
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it.for([
      {
        status: 403,
        statusText: 'Forbidden',
        detailKey: 'workspaceAuth.errors.accessDenied'
      },
      {
        status: 404,
        statusText: 'Not Found',
        detailKey: 'workspaceAuth.errors.workspaceNotFound'
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        detailKey: 'workspaceAuth.errors.invalidFirebaseToken'
      }
    ])(
      'surfaces the $status permanent refresh error as a toast and clears the slot',
      async ({ status, statusText, detailKey }) => {
        mockUnifiedCloudAuthEnabled.value = true
        mockGetIdToken.mockResolvedValue('firebase-token-xyz')
        const expiresInMs = 3600 * 1000
        const mockFetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                ...personalTokenResponse,
                expires_at: new Date(Date.now() + expiresInMs).toISOString()
              })
          })
          // The scheduled refresh is rejected with a permanent code.
          .mockResolvedValue({
            ok: false,
            status,
            statusText,
            json: () => Promise.resolve({ message: statusText })
          })
        vi.stubGlobal('fetch', mockFetch)

        const store = useWorkspaceAuthStore()
        const { unifiedToken } = storeToRefs(store)

        await store.mintAtLogin()
        expect(unifiedToken.value).toBe('unified-token-1')

        await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)

        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'error', detail: detailKey })
        )
        expect(unifiedToken.value).toBeNull()
      }
    )

    it('surfaces a NOT_AUTHENTICATED refresh (lost Firebase token) and clears the slot', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      const expiresInMs = 3600 * 1000
      // Mint succeeds, then the Firebase identity is gone at refresh time.
      mockGetIdToken
        .mockResolvedValueOnce('firebase-token-xyz')
        .mockResolvedValue(null)
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...personalTokenResponse,
              expires_at: new Date(Date.now() + expiresInMs).toISOString()
            })
        })
      )

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()
      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'workspaceAuth.errors.notAuthenticated'
        })
      )
      expect(unifiedToken.value).toBeNull()
    })

    it('does not toast on a successful refresh re-mint', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const expiresInMs = 3600 * 1000
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...personalTokenResponse,
              expires_at: new Date(Date.now() + expiresInMs).toISOString()
            })
        })
      )

      const store = useWorkspaceAuthStore()
      await store.mintAtLogin()
      await vi.advanceTimersByTimeAsync(expiresInMs - 5 * 60 * 1000)

      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('does not toast on a transient refresh failure and keeps the slot', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const expiresInMs = 3600 * 1000
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ...personalTokenResponse,
              expires_at: new Date(Date.now() + expiresInMs).toISOString()
            })
        })
        // A transient backend failure must not alarm the user or wipe the slot.
        .mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ message: 'try again' })
        })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      await store.mintAtLogin()

      const refreshDelay = expiresInMs - 5 * 60 * 1000
      await vi.advanceTimersByTimeAsync(refreshDelay)

      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(unifiedToken.value).toBe('unified-token-1')
    })

    it('surfaces an error toast and resolves false when the login mint hits a permanent auth error', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid token' })
      })
      vi.stubGlobal('fetch', mockFetch)

      const store = useWorkspaceAuthStore()
      const { unifiedToken } = storeToRefs(store)

      const result = await store.mintAtLogin()

      expect(result).toBe(false)
      expect(unifiedToken.value).toBeNull()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'workspaceAuth.errors.invalidFirebaseToken'
        })
      )
    })

    it('never toasts from the unified lifecycle when the flag is OFF', async () => {
      mockUnifiedCloudAuthEnabled.value = false
      mockGetIdToken.mockResolvedValue('firebase-token-xyz')
      // Even with a backend that would reject, the OFF lifecycle stays inert.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Access denied' })
        })
      )

      const store = useWorkspaceAuthStore()

      await store.mintAtLogin()
      await store.remintUnifiedOnce('unified-token-1')
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(mockToastAdd).not.toHaveBeenCalled()
    })
  })
})
