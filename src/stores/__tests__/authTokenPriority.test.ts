import type { User } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vuefire from 'vuefire'

import { useAuthStore } from '@/stores/authStore'
const { mockFeatureFlags } = vi.hoisted(() => ({
  mockFeatureFlags: {
    unifiedCloudAuthEnabled: false
  }
}))

const { mockDistributionTypes } = vi.hoisted(() => ({
  mockDistributionTypes: {
    isCloud: true,
    isDesktop: true
  }
}))

const mockWorkspaceAuthHeader = vi.fn().mockReturnValue(null)
const mockGetWorkspaceToken = vi.fn().mockReturnValue(undefined)
const mockEnsureWorkspaceAuthHeader = vi.fn()
const mockEnsureWorkspaceToken = vi.fn()
const mockClearWorkspaceContext = vi.fn()
const mockMintAtLogin = vi.fn().mockResolvedValue(false)
let mockUnifiedToken: string | null = null
const mockResetForIdentityChange = vi.fn()
const mockInitializeWorkspaces = vi.fn().mockResolvedValue(undefined)
let mockActiveWorkspaceId: string | null = null
let mockTeamWorkspaceInitState = 'ready'

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({
    getWorkspaceAuthHeader: mockWorkspaceAuthHeader,
    getWorkspaceToken: mockGetWorkspaceToken,
    ensureWorkspaceAuthHeader: mockEnsureWorkspaceAuthHeader,
    ensureWorkspaceToken: mockEnsureWorkspaceToken,
    getUnifiedToken: () => mockUnifiedToken ?? undefined,
    clearWorkspaceContext: mockClearWorkspaceContext,
    mintAtLogin: mockMintAtLogin,
    get unifiedToken() {
      return mockUnifiedToken
    }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return mockActiveWorkspaceId
    },
    get initState() {
      return mockTeamWorkspaceInitState
    },
    initialize: mockInitializeWorkspaces,
    resetForIdentityChange: mockResetForIdentityChange
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFeatureFlags
  })
}))

vi.mock('vuefire', () => ({
  useFirebaseAuth: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key } })
}))

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof firebaseAuth>()
  return {
    ...actual,
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    onIdTokenChanged: vi.fn(),
    signInWithPopup: vi.fn(),
    GoogleAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    },
    GithubAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    },
    getAdditionalUserInfo: vi.fn(),
    setPersistence: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackAuth: vi.fn() })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: vi.fn() })
}))

vi.mock('@/services/dialogService')
vi.mock('@/platform/distribution/types', () => mockDistributionTypes)

const mockApiKeyGetAuthHeader = vi.fn().mockReturnValue(null)
const mockApiKeyState = { isAuthenticated: false }
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({
    getAuthHeader: mockApiKeyGetAuthHeader,
    getApiKey: vi.fn(),
    currentUser: null,
    get isAuthenticated() {
      return mockApiKeyState.isAuthenticated
    },
    storeApiKey: vi.fn(),
    clearStoredApiKey: vi.fn()
  })
}))

type MockUser = Omit<User, 'getIdToken'> & { getIdToken: Mock }

describe('auth token priority chain', () => {
  let store: ReturnType<typeof useAuthStore>
  let authStateCallback: (user: User | null) => void

  const mockAuth: Record<string, unknown> = {}

  const mockUser: MockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    getIdToken: vi.fn().mockResolvedValue('firebase-token')
  } as Partial<User> as MockUser

  beforeEach(() => {
    mockDistributionTypes.isCloud = true
    mockFeatureFlags.unifiedCloudAuthEnabled = false
    mockUnifiedToken = null
    mockActiveWorkspaceId = null
    mockTeamWorkspaceInitState = 'ready'
    mockWorkspaceAuthHeader.mockReturnValue(null)
    mockGetWorkspaceToken.mockReturnValue(undefined)
    mockEnsureWorkspaceAuthHeader.mockResolvedValue(null)
    mockEnsureWorkspaceToken.mockResolvedValue(null)
    mockMintAtLogin.mockResolvedValue(false)
    mockInitializeWorkspaces.mockResolvedValue(undefined)
    mockApiKeyGetAuthHeader.mockReturnValue(null)
    mockApiKeyState.isAuthenticated = false
    mockUser.getIdToken.mockResolvedValue('firebase-token')

    vi.mocked(vuefire.useFirebaseAuth).mockReturnValue(
      mockAuth as unknown as ReturnType<typeof vuefire.useFirebaseAuth>
    )

    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      (_, callback) => {
        authStateCallback = callback as (user: User | null) => void
        ;(callback as (user: User | null) => void)(mockUser)
        return vi.fn()
      }
    )

    store = useAuthStore()
  })

  describe('getAuthHeader priority', () => {
    it('returns workspace auth header when workspace is active', async () => {
      mockWorkspaceAuthHeader.mockReturnValue({
        Authorization: 'Bearer workspace-token'
      })

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer workspace-token'
      })
    })

    it('returns Firebase token when workspace is not active but user is authenticated', async () => {
      mockWorkspaceAuthHeader.mockReturnValue(null)

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer firebase-token'
      })
    })

    it('ignores workspace auth header outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      mockWorkspaceAuthHeader.mockReturnValue({
        Authorization: 'Bearer workspace-token'
      })

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer firebase-token'
      })
    })

    it('keeps generic authentication user-scoped outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      mockActiveWorkspaceId = 'workspace-123'
      mockEnsureWorkspaceAuthHeader.mockResolvedValue({
        Authorization: 'Bearer workspace-token'
      })

      const header = await store.getAuthHeader()

      expect(mockEnsureWorkspaceAuthHeader).not.toHaveBeenCalled()
      expect(header).toEqual({ Authorization: 'Bearer firebase-token' })
    })

    it('returns API key when neither workspace nor Firebase are available', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'test-key' })

      const header = await store.getAuthHeader()

      expect(header).toEqual({ 'X-API-KEY': 'test-key' })
    })

    it('returns null when no auth method is available', async () => {
      authStateCallback(null)

      const header = await store.getAuthHeader()

      expect(header).toBeNull()
    })
  })

  describe('getAuthToken priority', () => {
    it('returns workspace token when workspace is active', async () => {
      mockGetWorkspaceToken.mockReturnValue('workspace-raw-token')

      const token = await store.getAuthToken()

      expect(token).toBe('workspace-raw-token')
    })

    it('returns Firebase token when workspace token is not available', async () => {
      mockGetWorkspaceToken.mockReturnValue(undefined)

      const token = await store.getAuthToken()

      expect(token).toBe('firebase-token')
    })

    it('keeps generic tokens user-scoped outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      mockActiveWorkspaceId = 'workspace-123'
      mockEnsureWorkspaceToken.mockResolvedValue('workspace-raw-token')

      const token = await store.getAuthToken()

      expect(mockEnsureWorkspaceToken).not.toHaveBeenCalled()
      expect(token).toBe('firebase-token')
    })
  })

  describe('explicit workspace authentication', () => {
    it('sends the stored API key for workspace calls in an API-key session', async () => {
      mockDistributionTypes.isCloud = false
      authStateCallback(null)
      mockApiKeyState.isAuthenticated = true
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'comfyui-test' })
      mockActiveWorkspaceId = 'workspace-123'

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        'X-API-KEY': 'comfyui-test'
      })
      expect(mockEnsureWorkspaceAuthHeader).not.toHaveBeenCalled()

      await expect(store.getWorkspaceAuthToken()).resolves.toBeUndefined()
      expect(mockEnsureWorkspaceToken).not.toHaveBeenCalled()
    })

    it('prefers the Firebase session over a stored API key for workspace calls', async () => {
      mockDistributionTypes.isCloud = false
      mockApiKeyState.isAuthenticated = true
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'comfyui-test' })
      mockActiveWorkspaceId = 'workspace-123'
      mockEnsureWorkspaceAuthHeader.mockResolvedValue({
        Authorization: 'Bearer workspace-token'
      })

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer workspace-token'
      })
    })

    it('uses selected workspace authentication outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      mockActiveWorkspaceId = 'workspace-123'
      mockEnsureWorkspaceAuthHeader.mockResolvedValue({
        Authorization: 'Bearer workspace-token'
      })
      mockEnsureWorkspaceToken.mockResolvedValue('workspace-raw-token')

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer workspace-token'
      })
      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(mockEnsureWorkspaceAuthHeader).toHaveBeenCalledWith(
        'workspace-123'
      )
      expect(mockEnsureWorkspaceToken).toHaveBeenCalledWith('workspace-123')
    })

    it('waits for workspace initialization before queue authentication', async () => {
      mockDistributionTypes.isCloud = false
      mockTeamWorkspaceInitState = 'uninitialized'
      mockInitializeWorkspaces.mockImplementation(async () => {
        mockActiveWorkspaceId = 'workspace-123'
        mockTeamWorkspaceInitState = 'ready'
      })
      mockEnsureWorkspaceToken.mockResolvedValue('workspace-raw-token')

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer firebase-token'
      })
      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(mockInitializeWorkspaces).toHaveBeenCalledOnce()
      expect(mockEnsureWorkspaceToken).toHaveBeenCalledWith('workspace-123')
    })

    it('waits for an in-flight workspace selection before queue authentication', async () => {
      mockDistributionTypes.isCloud = false
      mockTeamWorkspaceInitState = 'loading'
      mockInitializeWorkspaces.mockImplementation(async () => {
        mockActiveWorkspaceId = 'workspace-123'
        mockTeamWorkspaceInitState = 'ready'
      })
      mockEnsureWorkspaceToken.mockResolvedValue('workspace-raw-token')

      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('fails queue authentication closed after workspace initialization errors', async () => {
      mockDistributionTypes.isCloud = false
      mockTeamWorkspaceInitState = 'uninitialized'
      mockInitializeWorkspaces.mockRejectedValue(new Error('Network error'))

      await expect(store.getWorkspaceAuthToken()).resolves.toBeUndefined()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
      expect(mockEnsureWorkspaceToken).not.toHaveBeenCalled()
    })

    it('retries queue authentication after a previous initialization error', async () => {
      mockDistributionTypes.isCloud = false
      mockTeamWorkspaceInitState = 'error'
      mockInitializeWorkspaces.mockImplementation(async () => {
        mockActiveWorkspaceId = 'workspace-123'
        mockTeamWorkspaceInitState = 'ready'
      })
      mockEnsureWorkspaceToken.mockResolvedValue('workspace-raw-token')

      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(mockInitializeWorkspaces).toHaveBeenCalledOnce()
      expect(mockEnsureWorkspaceToken).toHaveBeenCalledWith('workspace-123')
    })
  })

  describe('unified login mint wiring', () => {
    it('mints the unified Cloud JWT when a cloud user signs in', () => {
      // beforeEach signs in mockUser via the onAuthStateChanged callback.
      expect(mockMintAtLogin).toHaveBeenCalled()
    })

    it('does not mint on sign-out', () => {
      mockMintAtLogin.mockClear()
      authStateCallback(null)
      expect(mockMintAtLogin).not.toHaveBeenCalled()
      expect(mockClearWorkspaceContext).toHaveBeenCalled()
    })

    it('clears account-scoped state before minting for a different user', () => {
      mockClearWorkspaceContext.mockClear()
      mockResetForIdentityChange.mockClear()
      mockMintAtLogin.mockClear()
      const nextUser = {
        ...mockUser,
        uid: 'different-user-id',
        email: 'different@example.com'
      } as MockUser

      authStateCallback(nextUser)

      expect(mockClearWorkspaceContext).toHaveBeenCalledOnce()
      expect(mockResetForIdentityChange).toHaveBeenCalledOnce()
      expect(mockMintAtLogin).toHaveBeenCalledOnce()
      expect(
        mockClearWorkspaceContext.mock.invocationCallOrder[0]
      ).toBeLessThan(mockMintAtLogin.mock.invocationCallOrder[0])
    })

    it('keeps account-scoped state for a repeated callback with the same uid', () => {
      mockClearWorkspaceContext.mockClear()
      mockResetForIdentityChange.mockClear()

      authStateCallback({ ...mockUser } as MockUser)

      expect(mockClearWorkspaceContext).not.toHaveBeenCalled()
      expect(mockResetForIdentityChange).not.toHaveBeenCalled()
    })
  })

  describe('unified cloud auth (flag ON)', () => {
    beforeEach(() => {
      mockFeatureFlags.unifiedCloudAuthEnabled = true
    })

    it('getAuthHeader returns only the unified Cloud JWT, never Firebase or API key', async () => {
      mockUnifiedToken = 'unified-jwt'
      // Even with the legacy sources available, the unified branch wins.
      mockWorkspaceAuthHeader.mockReturnValue({
        Authorization: 'Bearer workspace-token'
      })
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'test-key' })

      const header = await store.getAuthHeader()

      expect(header).toEqual({ Authorization: 'Bearer unified-jwt' })
      expect(mockWorkspaceAuthHeader).not.toHaveBeenCalled()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
      expect(mockApiKeyGetAuthHeader).not.toHaveBeenCalled()
    })

    it('getAuthHeader returns null when the unified token is empty and does not fall back', async () => {
      mockUnifiedToken = null
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'test-key' })

      const header = await store.getAuthHeader()

      expect(header).toBeNull()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
      expect(mockApiKeyGetAuthHeader).not.toHaveBeenCalled()
    })

    it('getAuthToken returns the unified Cloud JWT, never the Firebase token', async () => {
      mockUnifiedToken = 'unified-jwt'
      mockGetWorkspaceToken.mockReturnValue('workspace-raw-token')

      const token = await store.getAuthToken()

      expect(token).toBe('unified-jwt')
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('getAuthToken returns undefined when the unified token is empty and does not fall back', async () => {
      mockUnifiedToken = null

      const token = await store.getAuthToken()

      expect(token).toBeUndefined()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })
  })
})
