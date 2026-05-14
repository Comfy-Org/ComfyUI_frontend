import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockIsLoggedIn,
  mockCanAccessSubscriptionFeatures,
  mockRefreshRemoteConfig,
  mockRegisterExtension,
  mockWatchDebounced
} = vi.hoisted(() => ({
  mockIsLoggedIn: { value: false },
  mockCanAccessSubscriptionFeatures: { value: true },
  mockRefreshRemoteConfig: vi.fn(),
  mockRegisterExtension: vi.fn(),
  mockWatchDebounced: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  watchDebounced: mockWatchDebounced
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    isLoggedIn: mockIsLoggedIn
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures
  })
}))

vi.mock('@/platform/remoteConfig/refreshRemoteConfig', () => ({
  refreshRemoteConfig: mockRefreshRemoteConfig
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: mockRegisterExtension
  })
}))

describe('cloudRemoteConfig extension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsLoggedIn.value = false
    mockCanAccessSubscriptionFeatures.value = true
  })

  it('registers extension with correct name', async () => {
    await import('./cloudRemoteConfig')

    expect(mockRegisterExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Comfy.Cloud.RemoteConfig'
      })
    )
  })

  it('setup watches isLoggedIn and canAccessSubscriptionFeatures', async () => {
    await import('./cloudRemoteConfig')

    const registeredExtension = mockRegisterExtension.mock.calls[0][0]
    await registeredExtension.setup()

    expect(mockWatchDebounced).toHaveBeenCalledWith(
      [mockIsLoggedIn, mockCanAccessSubscriptionFeatures],
      expect.any(Function),
      expect.objectContaining({ debounce: 256, immediate: true })
    )
  })

  it('watch callback refreshes config when logged in', async () => {
    await import('./cloudRemoteConfig')

    const registeredExtension = mockRegisterExtension.mock.calls[0][0]
    await registeredExtension.setup()

    // Get the callback passed to watchDebounced
    const watchCallback = mockWatchDebounced.mock.calls[0][1]

    // Simulate logged in state
    mockIsLoggedIn.value = true
    watchCallback()

    expect(mockRefreshRemoteConfig).toHaveBeenCalled()
  })

  it('watch callback does not refresh when not logged in', async () => {
    await import('./cloudRemoteConfig')

    const registeredExtension = mockRegisterExtension.mock.calls[0][0]
    await registeredExtension.setup()

    const watchCallback = mockWatchDebounced.mock.calls[0][1]

    mockIsLoggedIn.value = false
    watchCallback()

    expect(mockRefreshRemoteConfig).not.toHaveBeenCalled()
  })
})
