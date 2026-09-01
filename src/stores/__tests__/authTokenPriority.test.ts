import type { User } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import { setActivePinia } from 'pinia'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vuefire from 'vuefire'

import { useAuthStore } from '@/stores/authStore'
import { createTestingPinia } from '@pinia/testing'

const { mockFeatureFlags } = vi.hoisted(() => ({
  mockFeatureFlags: {
    teamWorkspacesEnabled: false
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
const mockClearWorkspaceContext = vi.fn()

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({
    getWorkspaceAuthHeader: mockWorkspaceAuthHeader,
    getWorkspaceToken: mockGetWorkspaceToken,
    clearWorkspaceContext: mockClearWorkspaceContext
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

vi.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ add: vi.fn() })
}))

vi.mock('@/services/dialogService')
vi.mock('@/platform/distribution/types', () => mockDistributionTypes)

const mockApiKeyGetAuthHeader = vi.fn().mockReturnValue(null)
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({
    getAuthHeader: mockApiKeyGetAuthHeader,
    getApiKey: vi.fn(),
    currentUser: null,
    isAuthenticated: false,
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
    vi.resetAllMocks()

    mockFeatureFlags.teamWorkspacesEnabled = false
    mockWorkspaceAuthHeader.mockReturnValue(null)
    mockGetWorkspaceToken.mockReturnValue(undefined)
    mockApiKeyGetAuthHeader.mockReturnValue(null)
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

    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useAuthStore()
  })

  describe('getAuthHeader priority', () => {
    it('returns workspace auth header when workspace is active and feature enabled', async () => {
      mockFeatureFlags.teamWorkspacesEnabled = true
      mockWorkspaceAuthHeader.mockReturnValue({
        Authorization: 'Bearer workspace-token'
      })

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer workspace-token'
      })
    })

    it('returns Firebase token when workspace is not active but user is authenticated', async () => {
      mockFeatureFlags.teamWorkspacesEnabled = true
      mockWorkspaceAuthHeader.mockReturnValue(null)

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer firebase-token'
      })
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

    it('skips workspace header when team_workspaces feature is disabled', async () => {
      mockFeatureFlags.teamWorkspacesEnabled = false
      mockWorkspaceAuthHeader.mockReturnValue({
        Authorization: 'Bearer workspace-token'
      })

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer firebase-token'
      })
    })
  })

  describe('getAuthToken priority', () => {
    it('returns workspace token when workspace is active and feature enabled', async () => {
      mockFeatureFlags.teamWorkspacesEnabled = true
      mockGetWorkspaceToken.mockReturnValue('workspace-raw-token')

      const token = await store.getAuthToken()

      expect(token).toBe('workspace-raw-token')
    })

    it('returns Firebase token when workspace token is not available', async () => {
      mockFeatureFlags.teamWorkspacesEnabled = true
      mockGetWorkspaceToken.mockReturnValue(undefined)

      const token = await store.getAuthToken()

      expect(token).toBe('firebase-token')
    })
  })
})
