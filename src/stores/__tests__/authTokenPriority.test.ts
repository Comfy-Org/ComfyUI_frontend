import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
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

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: mockFeatureFlags
  })
}))

vi.mock(import('vuefire'), () => ({
  useFirebaseAuth: vi.fn()
}))

vi.mock(import('firebase/auth'))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({ trackAuth: vi.fn() })
}))

vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

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
    useWorkspaceAuthStore().unifiedToken = null
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    useTeamWorkspaceStore().initState = 'ready'
    vi.mocked(useWorkspaceAuthStore().getWorkspaceAuthHeader).mockReturnValue(
      null
    )
    vi.mocked(useWorkspaceAuthStore().getWorkspaceToken).mockReturnValue(
      undefined
    )
    vi.mocked(
      useWorkspaceAuthStore().ensureWorkspaceAuthHeader
    ).mockResolvedValue(null)
    vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken).mockResolvedValue(
      null
    )
    vi.mocked(useWorkspaceAuthStore().mintAtLogin).mockResolvedValue(false)
    vi.mocked(useWorkspaceAuthStore().clearWorkspaceContext).mockImplementation(
      () => {}
    )
    vi.mocked(useWorkspaceAuthStore().getUnifiedToken).mockImplementation(
      () => useWorkspaceAuthStore().unifiedToken ?? undefined
    )
    vi.mocked(
      useTeamWorkspaceStore().resetForIdentityChange
    ).mockImplementation(() => {})
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue(undefined)
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue(null)
    Object.assign(useApiKeyAuthStore(), { isAuthenticated: false })
    mockUser.getIdToken.mockResolvedValue('firebase-token')
  })

  describe('getAuthHeader priority', () => {
    it('returns workspace auth header when workspace is active', async () => {
      vi.mocked(useWorkspaceAuthStore().getWorkspaceAuthHeader).mockReturnValue(
        {
          Authorization: 'Bearer workspace-token'
        }
      )

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer workspace-token'
      })
    })

    it('returns Firebase token when workspace is not active but user is authenticated', async () => {
      vi.mocked(useWorkspaceAuthStore().getWorkspaceAuthHeader).mockReturnValue(
        null
      )

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer firebase-token'
      })
    })

    it('ignores workspace auth header outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      vi.mocked(useWorkspaceAuthStore().getWorkspaceAuthHeader).mockReturnValue(
        {
          Authorization: 'Bearer workspace-token'
        }
      )

      const header = await store.getAuthHeader()

      expect(header).toEqual({
        Authorization: 'Bearer firebase-token'
      })
    })

    it('keeps generic authentication user-scoped outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-123'
      })
      vi.mocked(
        useWorkspaceAuthStore().ensureWorkspaceAuthHeader
      ).mockResolvedValue({
        Authorization: 'Bearer workspace-token'
      })

      const header = await store.getAuthHeader()

      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceAuthHeader)
      ).not.toHaveBeenCalled()
      expect(header).toEqual({ Authorization: 'Bearer firebase-token' })
    })

    it('returns API key when neither workspace nor Firebase are available', async () => {
      authStateCallback(null)
      vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
        'X-API-KEY': 'test-key'
      })

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
      vi.mocked(useWorkspaceAuthStore().getWorkspaceToken).mockReturnValue(
        'workspace-raw-token'
      )

      const token = await store.getAuthToken()

      expect(token).toBe('workspace-raw-token')
    })

    it('returns Firebase token when workspace token is not available', async () => {
      vi.mocked(useWorkspaceAuthStore().getWorkspaceToken).mockReturnValue(
        undefined
      )

      const token = await store.getAuthToken()

      expect(token).toBe('firebase-token')
    })

    it('keeps generic tokens user-scoped outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-123'
      })
      vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken).mockResolvedValue(
        'workspace-raw-token'
      )

      const token = await store.getAuthToken()

      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken)
      ).not.toHaveBeenCalled()
      expect(token).toBe('firebase-token')
    })
  })

  describe('explicit workspace authentication', () => {
    it('sends the stored API key for workspace calls in an API-key session', async () => {
      mockDistributionTypes.isCloud = false
      authStateCallback(null)
      Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
      vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
        'X-API-KEY': 'comfyui-test'
      })
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-123'
      })

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        'X-API-KEY': 'comfyui-test'
      })
      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceAuthHeader)
      ).not.toHaveBeenCalled()

      await expect(store.getWorkspaceAuthToken()).resolves.toBeUndefined()
      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken)
      ).not.toHaveBeenCalled()
    })

    it('prefers the Firebase session over a stored API key for workspace calls', async () => {
      mockDistributionTypes.isCloud = false
      Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
      vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
        'X-API-KEY': 'comfyui-test'
      })
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-123'
      })
      vi.mocked(
        useWorkspaceAuthStore().ensureWorkspaceAuthHeader
      ).mockResolvedValue({
        Authorization: 'Bearer workspace-token'
      })

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer workspace-token'
      })
    })

    it('uses selected workspace authentication outside Cloud', async () => {
      mockDistributionTypes.isCloud = false
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-123'
      })
      vi.mocked(
        useWorkspaceAuthStore().ensureWorkspaceAuthHeader
      ).mockResolvedValue({
        Authorization: 'Bearer workspace-token'
      })
      vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken).mockResolvedValue(
        'workspace-raw-token'
      )

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer workspace-token'
      })
      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceAuthHeader)
      ).toHaveBeenCalledWith('workspace-123')
      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken)
      ).toHaveBeenCalledWith('workspace-123')
    })

    it('waits for workspace initialization before queue authentication', async () => {
      mockDistributionTypes.isCloud = false
      useTeamWorkspaceStore().initState = 'uninitialized'
      vi.mocked(useTeamWorkspaceStore().initialize).mockImplementation(
        async () => {
          Object.assign(useTeamWorkspaceStore(), {
            activeWorkspaceId: 'workspace-123'
          })
          useTeamWorkspaceStore().initState = 'ready'
        }
      )
      vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken).mockResolvedValue(
        'workspace-raw-token'
      )

      await expect(store.getWorkspaceAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer firebase-token'
      })
      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(
        vi.mocked(useTeamWorkspaceStore().initialize)
      ).toHaveBeenCalledOnce()
      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken)
      ).toHaveBeenCalledWith('workspace-123')
    })

    it('waits for an in-flight workspace selection before queue authentication', async () => {
      mockDistributionTypes.isCloud = false
      useTeamWorkspaceStore().initState = 'loading'
      vi.mocked(useTeamWorkspaceStore().initialize).mockImplementation(
        async () => {
          Object.assign(useTeamWorkspaceStore(), {
            activeWorkspaceId: 'workspace-123'
          })
          useTeamWorkspaceStore().initState = 'ready'
        }
      )
      vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken).mockResolvedValue(
        'workspace-raw-token'
      )

      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('fails queue authentication closed after workspace initialization errors', async () => {
      mockDistributionTypes.isCloud = false
      useTeamWorkspaceStore().initState = 'uninitialized'
      vi.mocked(useTeamWorkspaceStore().initialize).mockRejectedValue(
        new Error('Network error')
      )

      await expect(store.getWorkspaceAuthToken()).resolves.toBeUndefined()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken)
      ).not.toHaveBeenCalled()
    })

    it('retries queue authentication after a previous initialization error', async () => {
      mockDistributionTypes.isCloud = false
      useTeamWorkspaceStore().initState = 'error'
      vi.mocked(useTeamWorkspaceStore().initialize).mockImplementation(
        async () => {
          Object.assign(useTeamWorkspaceStore(), {
            activeWorkspaceId: 'workspace-123'
          })
          useTeamWorkspaceStore().initState = 'ready'
        }
      )
      vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken).mockResolvedValue(
        'workspace-raw-token'
      )

      await expect(store.getWorkspaceAuthToken()).resolves.toBe(
        'workspace-raw-token'
      )
      expect(
        vi.mocked(useTeamWorkspaceStore().initialize)
      ).toHaveBeenCalledOnce()
      expect(
        vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken)
      ).toHaveBeenCalledWith('workspace-123')
    })
  })

  describe('unified login mint wiring', () => {
    it('mints the unified Cloud JWT when a cloud user signs in', () => {
      // beforeEach signs in mockUser via the onAuthStateChanged callback.
      expect(vi.mocked(useWorkspaceAuthStore().mintAtLogin)).toHaveBeenCalled()
    })

    it('does not mint on sign-out', () => {
      vi.mocked(useWorkspaceAuthStore().mintAtLogin).mockClear()
      authStateCallback(null)
      expect(
        vi.mocked(useWorkspaceAuthStore().mintAtLogin)
      ).not.toHaveBeenCalled()
      expect(
        vi.mocked(useWorkspaceAuthStore().clearWorkspaceContext)
      ).toHaveBeenCalled()
    })

    it('clears account-scoped state before minting for a different user', () => {
      vi.mocked(useWorkspaceAuthStore().clearWorkspaceContext).mockClear()
      vi.mocked(useTeamWorkspaceStore().resetForIdentityChange).mockClear()
      vi.mocked(useWorkspaceAuthStore().mintAtLogin).mockClear()
      const nextUser = {
        ...mockUser,
        uid: 'different-user-id',
        email: 'different@example.com'
      } as MockUser

      authStateCallback(nextUser)

      expect(
        vi.mocked(useWorkspaceAuthStore().clearWorkspaceContext)
      ).toHaveBeenCalledOnce()
      expect(
        vi.mocked(useTeamWorkspaceStore().resetForIdentityChange)
      ).toHaveBeenCalledOnce()
      expect(
        vi.mocked(useWorkspaceAuthStore().mintAtLogin)
      ).toHaveBeenCalledOnce()
      expect(
        vi.mocked(useWorkspaceAuthStore().clearWorkspaceContext).mock
          .invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(useWorkspaceAuthStore().mintAtLogin).mock
          .invocationCallOrder[0]
      )
    })

    it('keeps account-scoped state for a repeated callback with the same uid', () => {
      vi.mocked(useWorkspaceAuthStore().clearWorkspaceContext).mockClear()
      vi.mocked(useTeamWorkspaceStore().resetForIdentityChange).mockClear()

      authStateCallback({ ...mockUser })

      expect(
        vi.mocked(useWorkspaceAuthStore().clearWorkspaceContext)
      ).not.toHaveBeenCalled()
      expect(
        vi.mocked(useTeamWorkspaceStore().resetForIdentityChange)
      ).not.toHaveBeenCalled()
    })
  })

  describe('unified cloud auth (flag ON)', () => {
    beforeEach(() => {
      mockFeatureFlags.unifiedCloudAuthEnabled = true
    })

    it('getAuthHeader returns only the unified Cloud JWT, never Firebase or API key', async () => {
      useWorkspaceAuthStore().unifiedToken = 'unified-jwt'
      // Even with the legacy sources available, the unified branch wins.
      vi.mocked(useWorkspaceAuthStore().getWorkspaceAuthHeader).mockReturnValue(
        {
          Authorization: 'Bearer workspace-token'
        }
      )
      vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
        'X-API-KEY': 'test-key'
      })

      const header = await store.getAuthHeader()

      expect(header).toEqual({ Authorization: 'Bearer unified-jwt' })
      expect(
        vi.mocked(useWorkspaceAuthStore().getWorkspaceAuthHeader)
      ).not.toHaveBeenCalled()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
      expect(
        vi.mocked(useApiKeyAuthStore().getAuthHeader)
      ).not.toHaveBeenCalled()
    })

    it('getAuthHeader returns null when the unified token is empty and does not fall back', async () => {
      useWorkspaceAuthStore().unifiedToken = null
      vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
        'X-API-KEY': 'test-key'
      })

      const header = await store.getAuthHeader()

      expect(header).toBeNull()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
      expect(
        vi.mocked(useApiKeyAuthStore().getAuthHeader)
      ).not.toHaveBeenCalled()
    })

    it('getAuthToken returns the unified Cloud JWT, never the Firebase token', async () => {
      useWorkspaceAuthStore().unifiedToken = 'unified-jwt'
      vi.mocked(useWorkspaceAuthStore().getWorkspaceToken).mockReturnValue(
        'workspace-raw-token'
      )

      const token = await store.getAuthToken()

      expect(token).toBe('unified-jwt')
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('getAuthToken returns undefined when the unified token is empty and does not fall back', async () => {
      useWorkspaceAuthStore().unifiedToken = null

      const token = await store.getAuthToken()

      expect(token).toBeUndefined()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })
  })
})
