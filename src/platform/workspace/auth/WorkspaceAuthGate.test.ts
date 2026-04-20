import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import WorkspaceAuthGate from './WorkspaceAuthGate.vue'

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

const mockIsInitialized = ref(false)
const mockCurrentUser = ref<object | null>(null)

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isInitialized: mockIsInitialized,
    currentUser: mockCurrentUser
  })
}))

const mockRefreshRemoteConfig = vi.fn()
vi.mock('@/platform/remoteConfig/refreshRemoteConfig', () => ({
  refreshRemoteConfig: (options: unknown) => mockRefreshRemoteConfig(options)
}))

const mockTeamWorkspacesEnabled = vi.hoisted(() => ({ value: false }))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get teamWorkspacesEnabled() {
        return mockTeamWorkspacesEnabled.value
      }
    }
  })
}))

const mockWorkspaceStoreInitialize = vi.fn()
const mockWorkspaceStoreInitState = vi.hoisted(() => ({
  value: 'uninitialized' as string
}))
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get initState() {
      return mockWorkspaceStoreInitState.value
    },
    initialize: mockWorkspaceStoreInitialize
  })
}))

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockResumePendingPricingFlow = vi.fn()
vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      show: vi.fn(),
      showPricingTable: vi.fn(),
      hide: vi.fn(),
      startTeamWorkspaceUpgradeFlow: vi.fn(),
      resumePendingPricingFlow: mockResumePendingPricingFlow
    })
  })
)

describe('WorkspaceAuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockIsInitialized.value = false
    mockCurrentUser.value = null
    mockTeamWorkspacesEnabled.value = false
    mockWorkspaceStoreInitState.value = 'uninitialized'
    mockRefreshRemoteConfig.mockResolvedValue(undefined)
    mockWorkspaceStoreInitialize.mockResolvedValue(undefined)
  })

  const i18n = createI18n({ legacy: false })

  const mountComponent = () =>
    render(WorkspaceAuthGate, {
      global: { plugins: [i18n] },
      slots: {
        default: '<div data-testid="slot-content">App Content</div>'
      }
    })

  describe('non-cloud builds', () => {
    it('renders slot immediately when isCloud is false', async () => {
      mockIsCloud.value = false

      mountComponent()
      await flushPromises()

      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
      expect(mockRefreshRemoteConfig).not.toHaveBeenCalled()
    })
  })

  describe('cloud builds - unauthenticated user', () => {
    it('hides slot while waiting for Firebase auth', () => {
      mockIsInitialized.value = false

      mountComponent()

      expect(screen.queryByTestId('slot-content')).not.toBeInTheDocument()
    })

    it('renders slot when Firebase initializes with no user', async () => {
      mockIsInitialized.value = false

      mountComponent()
      expect(screen.queryByTestId('slot-content')).not.toBeInTheDocument()

      mockIsInitialized.value = true
      mockCurrentUser.value = null
      await flushPromises()

      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
      expect(mockRefreshRemoteConfig).not.toHaveBeenCalled()
    })
  })

  describe('cloud builds - authenticated user', () => {
    beforeEach(() => {
      mockIsInitialized.value = true
      mockCurrentUser.value = { uid: 'user-123' }
    })

    it('refreshes remote config with auth after Firebase init', async () => {
      mountComponent()
      await flushPromises()

      expect(mockRefreshRemoteConfig).toHaveBeenCalledWith({ useAuth: true })
    })

    it('renders slot when teamWorkspacesEnabled is false', async () => {
      mockTeamWorkspacesEnabled.value = false

      mountComponent()
      await flushPromises()

      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
      expect(mockWorkspaceStoreInitialize).not.toHaveBeenCalled()
    })

    it('initializes workspace store when teamWorkspacesEnabled is true', async () => {
      mockTeamWorkspacesEnabled.value = true

      mountComponent()
      await flushPromises()

      expect(mockWorkspaceStoreInitialize).toHaveBeenCalled()
      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
    })

    it('calls resumePendingPricingFlow after successful workspace init', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockWorkspaceStoreInitState.value = 'ready'

      mountComponent()
      await flushPromises()

      expect(mockResumePendingPricingFlow).toHaveBeenCalled()
    })

    it('skips workspace init when store is already initialized', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockWorkspaceStoreInitState.value = 'ready'

      mountComponent()
      await flushPromises()

      expect(mockWorkspaceStoreInitialize).not.toHaveBeenCalled()
      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
    })
  })

  describe('error handling - graceful degradation', () => {
    beforeEach(() => {
      mockIsInitialized.value = true
      mockCurrentUser.value = { uid: 'user-123' }
    })

    it('renders slot when remote config refresh fails', async () => {
      mockRefreshRemoteConfig.mockRejectedValue(new Error('Network error'))

      mountComponent()
      await flushPromises()

      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
    })

    it('renders slot when remote config refresh times out', async () => {
      vi.useFakeTimers()
      try {
        // Never-resolving promise simulates a hanging request
        mockRefreshRemoteConfig.mockReturnValue(new Promise(() => {}))

        mountComponent()
        await vi.advanceTimersByTimeAsync(0)

        // Slot not yet rendered before timeout
        expect(screen.queryByTestId('slot-content')).not.toBeInTheDocument()

        // Advance past the 10 second timeout
        await vi.advanceTimersByTimeAsync(10_001)

        // Should render slot after timeout (graceful degradation)
        expect(screen.getByTestId('slot-content')).toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('renders slot when workspace store initialization fails', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockWorkspaceStoreInitialize.mockRejectedValue(
        new Error('Workspace init failed')
      )

      mountComponent()
      await flushPromises()

      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
    })
  })
})
