import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { AuthStoreError } from '@/stores/authStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'

// authStore initialises Firebase at module setup, which cannot run under test.
const { mockCreateCustomer, MockAuthStoreError } = vi.hoisted(() => {
  class MockAuthStoreError extends Error {
    readonly status: number | undefined
    constructor(message: string, status?: number) {
      super(message)
      this.name = 'AuthStoreError'
      this.status = status
    }
  }
  return { mockCreateCustomer: vi.fn(), MockAuthStoreError }
})

vi.mock('@/stores/authStore', () => ({
  AuthStoreError: MockAuthStoreError,
  useAuthStore: () => ({ createCustomer: mockCreateCustomer })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

const STORAGE_KEY = 'comfy_api_key'
const VALID_KEY = 'comfyui-valid-key'
const customer = { id: 'customer-1', email: 'user@example.com' }

const severities = () =>
  useToastStore().messagesToAdd.map((m) => `${m.severity}:${m.summary}`)

describe('useApiKeyAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    mockCreateCustomer.mockReset()
  })

  describe('storeApiKey', () => {
    it('reports success and authenticates only once the key is validated', async () => {
      mockCreateCustomer.mockResolvedValue(customer)
      const store = useApiKeyAuthStore()

      await expect(store.storeApiKey(VALID_KEY)).resolves.toBe(true)

      expect(store.isAuthenticated).toBe(true)
      expect(localStorage.getItem(STORAGE_KEY)).toBe(VALID_KEY)
      expect(severities()).toEqual(['success:auth.apiKey.stored'])
    })

    it.for([401, 403])(
      'does not claim success when validation returns %i',
      async (status) => {
        mockCreateCustomer.mockRejectedValue(
          new AuthStoreError('rejected', status)
        )
        const store = useApiKeyAuthStore()

        await expect(store.storeApiKey(VALID_KEY)).resolves.toBeFalsy()

        expect(store.isAuthenticated).toBe(false)
        expect(severities()).toEqual(['error:auth.apiKey.invalid'])
      }
    )

    it('discards a rejected key so it is not reused on the next launch', async () => {
      mockCreateCustomer.mockRejectedValue(new AuthStoreError('rejected', 401))
      const store = useApiKeyAuthStore()

      await store.storeApiKey(VALID_KEY)
      await nextTick()

      expect(store.getApiKey()).toBeNull()
    })

    it('keeps the key but reports the failure when validation is unavailable', async () => {
      mockCreateCustomer.mockRejectedValue(
        new AuthStoreError('unavailable', 503)
      )
      const store = useApiKeyAuthStore()

      await expect(store.storeApiKey(VALID_KEY)).resolves.toBeFalsy()

      expect(store.isAuthenticated).toBe(false)
      expect(store.getApiKey()).toBe(VALID_KEY)
      expect(severities()).toEqual([
        'error:auth.apiKey.verificationUnavailable'
      ])
    })

    it('validates the key exactly once per sign-in', async () => {
      mockCreateCustomer.mockResolvedValue(customer)
      const store = useApiKeyAuthStore()

      await store.storeApiKey(VALID_KEY)
      await nextTick()

      expect(mockCreateCustomer).toHaveBeenCalledTimes(1)
    })
  })

  describe('a key restored from storage', () => {
    it('reports a key the backend now rejects', async () => {
      localStorage.setItem(STORAGE_KEY, VALID_KEY)
      mockCreateCustomer.mockRejectedValue(new AuthStoreError('rejected', 401))

      const store = useApiKeyAuthStore()
      await vi.waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled())
      await nextTick()

      expect(store.isAuthenticated).toBe(false)
      expect(severities()).toEqual(['error:auth.apiKey.invalid'])
    })

    it('stays quiet when the backend is merely unreachable', async () => {
      localStorage.setItem(STORAGE_KEY, VALID_KEY)
      mockCreateCustomer.mockRejectedValue(new TypeError('Failed to fetch'))

      const store = useApiKeyAuthStore()
      await vi.waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled())
      await nextTick()

      expect(store.isAuthenticated).toBe(false)
      expect(store.getApiKey()).toBe(VALID_KEY)
      expect(severities()).toEqual([])
    })
  })
})
