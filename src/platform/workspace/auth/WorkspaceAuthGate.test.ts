import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import WorkspaceAuthGate from './WorkspaceAuthGate.vue'

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

const mockCaptureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/vue', () => ({
  captureException: mockCaptureException
}))

const mockIsInitialized = ref(false)
const mockCurrentUser = ref<object | null>(null)
const mockLogout = vi.fn()

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isInitialized: mockIsInitialized,
    currentUser: mockCurrentUser
  })
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({ logout: mockLogout })
}))

const mockRefreshRemoteConfig = vi.fn()
vi.mock('@/platform/remoteConfig/refreshRemoteConfig', () => ({
  refreshRemoteConfig: (options: unknown) => mockRefreshRemoteConfig(options)
}))

const mockRemoteConfigState = vi.hoisted(() => ({
  value: 'authenticated' as
    | 'uninitialized'
    | 'anonymous'
    | 'authenticated'
    | 'error'
}))
const mockRemoteConfigErrorStatus = vi.hoisted(() => ({
  value: null as number | null
}))
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfigState: mockRemoteConfigState,
  remoteConfigErrorStatus: mockRemoteConfigErrorStatus
}))

const mockUnifiedCloudAuthEnabled = vi.hoisted(() => ({ value: false }))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get unifiedCloudAuthEnabled() {
        return mockUnifiedCloudAuthEnabled.value
      }
    }
  })
}))

const mockMintAtLogin = vi.fn()
const mockGetUnifiedToken = vi.fn()
vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({
    mintAtLogin: mockMintAtLogin,
    getUnifiedToken: mockGetUnifiedToken
  })
}))

const mockWorkspaceStoreInitialize = vi.fn()
const mockWorkspaceStoreInitState = vi.hoisted(() => ({
  value: 'uninitialized' as string
}))
const mockActiveWorkspaceId = vi.hoisted(() => ({
  value: 'workspace-123' as string | null
}))
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get initState() {
      return mockWorkspaceStoreInitState.value
    },
    get activeWorkspaceId() {
      return mockActiveWorkspaceId.value
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
    mockIsCloud.value = true
    mockIsInitialized.value = false
    mockCurrentUser.value = null
    mockUnifiedCloudAuthEnabled.value = false
    mockRemoteConfigState.value = 'authenticated'
    mockRemoteConfigErrorStatus.value = null
    mockWorkspaceStoreInitState.value = 'uninitialized'
    mockActiveWorkspaceId.value = 'workspace-123'
    mockRefreshRemoteConfig.mockResolvedValue(undefined)
    mockWorkspaceStoreInitialize.mockImplementation(async () => {
      mockWorkspaceStoreInitState.value = 'ready'
    })
    mockMintAtLogin.mockResolvedValue(true)
    mockGetUnifiedToken.mockReturnValue('cloud-jwt')
  })

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

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

    it('shows the recovery panel when Firebase initialization times out', async () => {
      vi.useFakeTimers()
      try {
        mountComponent()

        await vi.advanceTimersByTimeAsync(16_001)

        expect(
          screen.getByText("Couldn't load your workspace")
        ).toBeInTheDocument()
        expect(mockCaptureException).toHaveBeenCalledOnce()
      } finally {
        vi.useRealTimers()
      }
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

      expect(mockRefreshRemoteConfig).toHaveBeenCalledWith({
        useAuth: true,
        signal: expect.any(AbortSignal)
      })
    })

    it('mints unified auth after refreshing authenticated flags', async () => {
      mockRefreshRemoteConfig.mockImplementation(async () => {
        mockUnifiedCloudAuthEnabled.value = true
      })

      mountComponent()
      await flushPromises()

      expect(mockMintAtLogin).toHaveBeenCalledOnce()
      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
    })

    it('initializes the workspace store', async () => {
      mountComponent()
      await flushPromises()

      expect(mockWorkspaceStoreInitialize).toHaveBeenCalled()
      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
    })

    it('stops initialization when unmounted', async () => {
      let resolveRefresh: (() => void) | undefined
      mockRefreshRemoteConfig.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveRefresh = resolve
          })
      )

      const { unmount } = mountComponent()
      await vi.waitFor(() =>
        expect(mockRefreshRemoteConfig).toHaveBeenCalledOnce()
      )
      const signal = mockRefreshRemoteConfig.mock.calls[0][0].signal
      unmount()
      resolveRefresh?.()
      await flushPromises()

      expect(signal.aborted).toBe(true)
      expect(mockWorkspaceStoreInitialize).not.toHaveBeenCalled()
      expect(mockResumePendingPricingFlow).not.toHaveBeenCalled()
      expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('calls resumePendingPricingFlow after successful workspace init', async () => {
      mockWorkspaceStoreInitState.value = 'ready'

      mountComponent()
      await flushPromises()

      expect(mockResumePendingPricingFlow).toHaveBeenCalled()
    })

    it('skips workspace init when store is already initialized', async () => {
      mockWorkspaceStoreInitState.value = 'ready'

      mountComponent()
      await flushPromises()

      expect(mockWorkspaceStoreInitialize).not.toHaveBeenCalled()
      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      mockIsInitialized.value = true
      mockCurrentUser.value = { uid: 'user-123' }
    })

    it('shows a recoverable error when remote config refresh fails', async () => {
      const error = new Error('Network error')
      mockRefreshRemoteConfig.mockRejectedValue(error)
      const splashLoader = document.createElement('div')
      splashLoader.id = 'splash-loader'
      document.body.append(splashLoader)

      mountComponent()
      await flushPromises()

      expect(
        screen.getByText("Couldn't load your workspace")
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Try again' })
      ).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveFocus()
      expect(splashLoader).not.toBeInTheDocument()
      expect(mockCaptureException).toHaveBeenCalledWith(error, {
        tags: {
          error_type: 'workspace_auth_gate_initialization_failure'
        }
      })
    })

    it('shows a recoverable error when remote config refresh times out', async () => {
      vi.useFakeTimers()
      try {
        // Never-resolving promise simulates a hanging request
        mockRefreshRemoteConfig.mockReturnValue(new Promise(() => {}))

        mountComponent()
        await vi.advanceTimersByTimeAsync(0)

        // Slot not yet rendered before timeout
        expect(screen.queryByTestId('slot-content')).not.toBeInTheDocument()
        expect(
          screen.queryByText("Couldn't load your workspace")
        ).not.toBeInTheDocument()

        // Advance past the 10 second timeout
        await vi.advanceTimersByTimeAsync(10_001)

        expect(
          screen.getByText("Couldn't load your workspace")
        ).toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('shows a recoverable error when authenticated config is unavailable', async () => {
      mockRemoteConfigState.value = 'error'

      mountComponent()
      await flushPromises()

      expect(
        screen.getByText("Couldn't load your workspace")
      ).toBeInTheDocument()
      expect(mockWorkspaceStoreInitialize).not.toHaveBeenCalled()
    })

    it('requires sign out when authenticated config rejects the credential', async () => {
      const user = userEvent.setup()
      mockRemoteConfigState.value = 'error'
      mockRemoteConfigErrorStatus.value = 401

      mountComponent()
      await flushPromises()

      expect(
        screen.queryByRole('button', { name: 'Try again' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('Sign out and log in again to continue.')
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Log Out' }))
      expect(mockLogout).toHaveBeenCalledOnce()
    })

    it('shows a recoverable error when unified auth initialization fails', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockMintAtLogin.mockResolvedValue(false)

      mountComponent()
      await flushPromises()

      expect(
        screen.getByText("Couldn't load your workspace")
      ).toBeInTheDocument()
      expect(mockWorkspaceStoreInitialize).not.toHaveBeenCalled()
    })

    it('shows a recoverable error when workspace store initialization fails', async () => {
      mockWorkspaceStoreInitialize.mockRejectedValue(
        new Error('Workspace init failed')
      )

      mountComponent()
      await flushPromises()

      expect(
        screen.getByText("Couldn't load your workspace")
      ).toBeInTheDocument()
    })

    it('requires sign out when no workspace is available', async () => {
      mockWorkspaceStoreInitialize.mockRejectedValue(
        new Error('No workspaces available')
      )

      mountComponent()
      await flushPromises()

      expect(
        screen.queryByRole('button', { name: 'Try again' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Log Out' })
      ).toBeInTheDocument()
    })

    it('shows a recoverable error when workspace setup clears unified auth', async () => {
      mockUnifiedCloudAuthEnabled.value = true
      mockGetUnifiedToken.mockReturnValue(undefined)

      mountComponent()
      await flushPromises()

      expect(
        screen.getByText("Couldn't load your workspace")
      ).toBeInTheDocument()
    })

    it('shows a recoverable error without a ready workspace context', async () => {
      mockWorkspaceStoreInitState.value = 'loading'

      mountComponent()
      await flushPromises()

      expect(
        screen.getByText("Couldn't load your workspace")
      ).toBeInTheDocument()
    })

    it('renders the app after retrying a failed initialization', async () => {
      const user = userEvent.setup()
      mockWorkspaceStoreInitialize
        .mockImplementationOnce(async () => {
          mockWorkspaceStoreInitState.value = 'error'
          throw new Error('Workspace init failed')
        })
        .mockImplementationOnce(async () => {
          mockWorkspaceStoreInitState.value = 'ready'
        })

      mountComponent()
      await flushPromises()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      await flushPromises()

      expect(screen.getByTestId('slot-content')).toBeInTheDocument()
      expect(mockWorkspaceStoreInitialize).toHaveBeenCalledTimes(2)
    })

    it('keeps the retry action named while retrying', async () => {
      const user = userEvent.setup()
      let resolveRetry: (() => void) | undefined
      mockRefreshRemoteConfig
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveRetry = resolve
            })
        )

      mountComponent()
      await flushPromises()
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(screen.getByRole('button', { name: 'Try again' })).toHaveAttribute(
        'aria-busy',
        'true'
      )

      resolveRetry?.()
    })

    it('stops a pending retry before logging out', async () => {
      const user = userEvent.setup()
      let resolveRetry: (() => void) | undefined
      mockRefreshRemoteConfig
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveRetry = resolve
            })
        )

      mountComponent()
      await flushPromises()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      const retrySignal = mockRefreshRemoteConfig.mock.calls[1][0].signal
      await user.click(screen.getByRole('button', { name: 'Log Out' }))
      resolveRetry?.()
      await flushPromises()

      expect(retrySignal.aborted).toBe(true)
      expect(mockLogout).toHaveBeenCalledOnce()
      expect(mockWorkspaceStoreInitialize).not.toHaveBeenCalled()
      expect(mockResumePendingPricingFlow).not.toHaveBeenCalled()
    })
  })
})
