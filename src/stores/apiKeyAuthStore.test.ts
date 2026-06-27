import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'

const authStoreMock = vi.hoisted(() => ({
  createCustomer: vi.fn()
}))

const toastStoreMock = vi.hoisted(() => ({
  add: vi.fn()
}))

const errorHandlingMock = vi.hoisted(() => ({
  toastErrorHandler: vi.fn(),
  forceGenericFailure: false,
  forceStorageFailure: false
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => authStoreMock
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => toastStoreMock
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: errorHandlingMock.toastErrorHandler,
    wrapWithErrorHandlingAsync:
      (
        fn: (value?: string) => Promise<boolean>,
        onError: (e: unknown) => void
      ) =>
      async (value?: string) => {
        try {
          if (errorHandlingMock.forceStorageFailure) {
            throw new Error('STORAGE_FAILED')
          }
          if (errorHandlingMock.forceGenericFailure) {
            throw new Error('OTHER_FAILED')
          }
          return await fn(value)
        } catch (e) {
          onError(e)
          return false
        }
      }
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

describe('apiKeyAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    authStoreMock.createCustomer.mockReset()
    toastStoreMock.add.mockClear()
    errorHandlingMock.toastErrorHandler.mockClear()
    errorHandlingMock.forceGenericFailure = false
    errorHandlingMock.forceStorageFailure = false
  })

  it('stores an API key, initializes the user, and returns an auth header', async () => {
    authStoreMock.createCustomer.mockResolvedValue({ id: 'user-1' })
    const store = useApiKeyAuthStore()

    await expect(store.storeApiKey('secret')).resolves.toBe(true)
    await vi.waitFor(() => expect(store.currentUser).toEqual({ id: 'user-1' }))

    expect(store.isAuthenticated).toBe(true)
    expect(store.getApiKey()).toBe('secret')
    expect(store.getAuthHeader()).toEqual({ 'X-API-KEY': 'secret' })
    expect(toastStoreMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('clears the user when the API key is cleared', async () => {
    authStoreMock.createCustomer.mockResolvedValue({ id: 'user-1' })
    const store = useApiKeyAuthStore()

    await store.storeApiKey('secret')
    await vi.waitFor(() => expect(store.currentUser).toEqual({ id: 'user-1' }))
    await expect(store.clearStoredApiKey()).resolves.toBe(true)

    expect(store.currentUser).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.getAuthHeader()).toBeNull()
  })

  it('reports storage failures through the API-key toast copy', async () => {
    errorHandlingMock.forceStorageFailure = true
    const store = useApiKeyAuthStore()

    await expect(store.storeApiKey('secret')).resolves.toBe(false)

    expect(toastStoreMock.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'auth.apiKey.storageFailed',
      detail: 'auth.apiKey.storageFailedDetail'
    })
    expect(errorHandlingMock.toastErrorHandler).not.toHaveBeenCalled()
  })

  it('reports non-storage failures through the generic toast handler', async () => {
    errorHandlingMock.forceGenericFailure = true
    const store = useApiKeyAuthStore()

    await expect(store.storeApiKey('secret')).resolves.toBe(false)

    expect(errorHandlingMock.toastErrorHandler).toHaveBeenCalledWith(
      expect.any(Error)
    )
  })
})
