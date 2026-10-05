import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

const { mockDistributionTypes } = vi.hoisted(() => ({
  mockDistributionTypes: {
    isCloud: true,
    isDesktop: true
  }
}))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('firebase/auth'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

type MockUser = Omit<User, 'getIdToken'> & {
  getIdToken: Mock<User['getIdToken']>
}

/**
 * Regression coverage for #17271: on a remote non-Cloud origin (e.g. a
 * RunPod HTTPS proxy) the browser CORS-blocks GET cloud.comfy.org/api/workspaces,
 * so teamWorkspaceStore.initialize() rejects and getWorkspaceAuthToken must
 * still hand queue execution a usable credential — the Firebase ID token —
 * instead of failing closed and 401ing the backend.
 */
describe('getWorkspaceAuthToken remote-origin workspace init failure', () => {
  let store: ReturnType<typeof useAuthStore>

  const mockUser = fromPartial<MockUser>({
    uid: 'test-user-id',
    email: 'test@example.com',
    getIdToken: vi.fn().mockResolvedValue('firebase-token')
  })

  beforeEach(() => {
    mockDistributionTypes.isCloud = false
    stubFirebaseAuthHarness()
    const authStateObservers: Array<(user: User | null) => void> = []
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      (_, callback) => {
        const observer = callback as (user: User | null) => void
        authStateObservers.push(observer)
        observer(mockUser)
        return vi.fn()
      }
    )
    store = useAuthStore()
    useWorkspaceAuthStore().destroy()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    useTeamWorkspaceStore().initState = 'uninitialized'
    vi.mocked(useWorkspaceAuthStore().ensureWorkspaceToken).mockResolvedValue(
      null
    )
    vi.mocked(
      useTeamWorkspaceStore().resetForIdentityChange
    ).mockImplementation(() => {})
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue(null)
    Object.assign(useApiKeyAuthStore(), { isAuthenticated: false })
    mockUser.getIdToken.mockClear()
    mockUser.getIdToken.mockResolvedValue('firebase-token')
  })

  it('falls back to the Firebase token when workspace init fails with a network error', async () => {
    vi.mocked(useTeamWorkspaceStore().initialize).mockRejectedValue(
      new Error('Network Error')
    )

    await expect(store.getWorkspaceAuthToken()).resolves.toBe('firebase-token')
  })

  it('still falls back when a previous boot left the store in the error state', async () => {
    useTeamWorkspaceStore().initState = 'error'
    vi.mocked(useTeamWorkspaceStore().initialize).mockRejectedValue(
      new Error('Network Error')
    )

    await expect(store.getWorkspaceAuthToken()).resolves.toBe('firebase-token')
  })
})
