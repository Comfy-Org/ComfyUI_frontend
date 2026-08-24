import type { User } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vuefire from 'vuefire'

import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const mockFetch = vi.fn()

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
    onAuthStateChanged: vi.fn(),
    onIdTokenChanged: vi.fn(),
    setPersistence: vi.fn().mockResolvedValue(undefined),
    GoogleAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    },
    GithubAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    }
  }
})

vi.mock('@/platform/distribution/types', () => ({
  DISTRIBUTION: 'cloud',
  isCloud: true,
  isDesktop: false
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: { unifiedCloudAuthEnabled: false }
  })
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({
    clearWorkspaceContext: vi.fn(),
    getWorkspaceAuthHeader: vi.fn().mockReturnValue(null),
    getUnifiedToken: vi.fn().mockReturnValue(undefined),
    mintAtLogin: vi.fn()
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    activeWorkspaceId: null,
    resetForIdentityChange: vi.fn()
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackAuth: vi.fn() })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showErrorDialog: vi.fn() })
}))

describe('API key authentication initialization', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue({
      ok: true,
      statusText: 'OK',
      json: () => Promise.resolve({ id: 'test-customer-id' })
    })

    vi.mocked(vuefire.useFirebaseAuth).mockReturnValue(
      {} as ReturnType<typeof vuefire.useFirebaseAuth>
    )
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      (_, callback) => {
        ;(callback as (user: User | null) => void)(null)
        return vi.fn()
      }
    )
    vi.mocked(firebaseAuth.onIdTokenChanged).mockReturnValue(vi.fn())
  })

  it('retains and validates a persisted key while the API key store initializes', async () => {
    localStorage.setItem('comfy_api_key', 'persisted-api-key')
    useAuthStore()

    const apiKeyStore = useApiKeyAuthStore()

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce())

    expect(apiKeyStore.getApiKey()).toBe('persisted-api-key')
    expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-KEY': 'persisted-api-key'
        })
      })
    )
  })
})
