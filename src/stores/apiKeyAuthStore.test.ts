import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { AuthStoreError } from '@/stores/authStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'

const { mockTrackAuthFailed } = vi.hoisted(() => ({
  mockTrackAuthFailed: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackAuthFailed: mockTrackAuthFailed })
}))

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
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockCreateCustomer.mockReset()
    mockTrackAuthFailed.mockReset()
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

    it.for([
      [401, 'auth.apiKey.invalid'],
      [403, 'auth.apiKey.notPermitted']
    ] as const)(
      'does not claim success when validation returns %i',
      async ([status, summary]) => {
        mockCreateCustomer.mockRejectedValue(
          new AuthStoreError('refused', status)
        )
        const store = useApiKeyAuthStore()

        await expect(store.storeApiKey(VALID_KEY)).resolves.toBeFalsy()

        expect(store.isAuthenticated).toBe(false)
        expect(severities()).toEqual([`error:${summary}`])
      }
    )

    it('discards a rejected key so it is not reused on the next launch', async () => {
      mockCreateCustomer.mockRejectedValue(new AuthStoreError('rejected', 401))
      const store = useApiKeyAuthStore()

      await store.storeApiKey(VALID_KEY)
      await nextTick()

      expect(store.getApiKey()).toBeNull()
    })

    it('keeps the key when the account is refused rather than the key', async () => {
      mockCreateCustomer.mockRejectedValue(new AuthStoreError('denied', 403))
      const store = useApiKeyAuthStore()

      await store.storeApiKey(VALID_KEY)
      await nextTick()

      expect(store.getApiKey()).toBe(VALID_KEY)
    })

    it('ignores a second attempt while one is still being validated', async () => {
      let resolve!: (value: typeof customer) => void
      mockCreateCustomer.mockReturnValue(
        new Promise<typeof customer>((res) => {
          resolve = res
        })
      )
      const store = useApiKeyAuthStore()

      const first = store.storeApiKey(VALID_KEY)
      expect(store.isValidating).toBe(true)

      await expect(store.storeApiKey('comfyui-other-key')).resolves.toBe(false)

      resolve(customer)
      await expect(first).resolves.toBe(true)
      expect(store.isValidating).toBe(false)
      expect(mockCreateCustomer).toHaveBeenCalledTimes(1)
      expect(store.getApiKey()).toBe(VALID_KEY)
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

  describe('a restored key still being validated when a new one is signed in', () => {
    it('does not let the older verdict clear the newly stored key', async () => {
      localStorage.setItem(STORAGE_KEY, 'comfyui-restored-key')
      let rejectRestored!: (reason: unknown) => void
      mockCreateCustomer.mockReturnValueOnce(
        new Promise((_, rej) => {
          rejectRestored = rej
        })
      )

      const store = useApiKeyAuthStore()
      await vi.waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled())

      mockCreateCustomer.mockResolvedValueOnce(customer)
      await expect(store.storeApiKey(VALID_KEY)).resolves.toBe(true)

      rejectRestored(new AuthStoreError('rejected', 401))
      await nextTick()

      expect(store.getApiKey()).toBe(VALID_KEY)
      expect(store.isAuthenticated).toBe(true)
      expect(severities()).toEqual(['success:auth.apiKey.stored'])
    })
  })

  describe('reporting failures for alerting', () => {
    it.for([
      [401, 'rejected_401'],
      [403, 'denied_403'],
      [503, 'unverified_503']
    ] as const)('reports a %i as %s', async ([status, code]) => {
      mockCreateCustomer.mockRejectedValue(new AuthStoreError('failed', status))
      const store = useApiKeyAuthStore()

      await store.storeApiKey(VALID_KEY)

      expect(mockTrackAuthFailed).toHaveBeenCalledWith({
        error_code: code,
        auth_action: 'api_key_sign_in'
      })
    })

    it('reports the unreachable-backend case the UI only logs', async () => {
      localStorage.setItem(STORAGE_KEY, VALID_KEY)
      mockCreateCustomer.mockRejectedValue(new TypeError('Failed to fetch'))

      useApiKeyAuthStore()
      await vi.waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled())
      await nextTick()

      expect(severities()).toEqual([])
      expect(mockTrackAuthFailed).toHaveBeenCalledWith({
        error_code: 'unverified',
        auth_action: 'api_key_sign_in'
      })
    })

    it('still discards the key and tells the user when reporting throws', async () => {
      mockTrackAuthFailed.mockImplementation(() => {
        throw new Error('telemetry is down')
      })
      mockCreateCustomer.mockRejectedValue(new AuthStoreError('rejected', 401))
      const store = useApiKeyAuthStore()

      await expect(store.storeApiKey(VALID_KEY)).resolves.toBeFalsy()
      await nextTick()

      expect(store.getApiKey()).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(severities()).toEqual(['error:auth.apiKey.invalid'])
    })

    it('reports nothing when the key is accepted', async () => {
      mockCreateCustomer.mockResolvedValue(customer)
      const store = useApiKeyAuthStore()

      await store.storeApiKey(VALID_KEY)

      expect(mockTrackAuthFailed).not.toHaveBeenCalled()
    })
  })

  describe('replacing the key of an authenticated session', () => {
    it('stops reporting the previous identity while the new key is unverified', async () => {
      mockCreateCustomer.mockResolvedValueOnce(customer)
      const store = useApiKeyAuthStore()
      await store.storeApiKey(VALID_KEY)
      expect(store.isAuthenticated).toBe(true)

      const replacement = { id: 'customer-2', email: 'second@example.com' }
      let resolveReplacement!: (value: typeof customer) => void
      mockCreateCustomer.mockReturnValueOnce(
        new Promise<typeof customer>((res) => {
          resolveReplacement = res
        })
      )

      const signIn = store.storeApiKey('comfyui-replacement-key')
      await nextTick()
      expect(store.isAuthenticated).toBe(false)

      resolveReplacement(replacement)
      await expect(signIn).resolves.toBe(true)
      expect(store.currentUser).toEqual(replacement)
    })
  })

  describe('clearing the key while it is being validated', () => {
    it('does not let the in-flight result sign the user back in', async () => {
      localStorage.setItem(STORAGE_KEY, VALID_KEY)
      let resolveRestored!: (value: typeof customer) => void
      mockCreateCustomer.mockReturnValue(
        new Promise<typeof customer>((res) => {
          resolveRestored = res
        })
      )

      const store = useApiKeyAuthStore()
      await vi.waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled())

      await store.clearStoredApiKey()
      resolveRestored(customer)
      await nextTick()

      expect(store.getApiKey()).toBeNull()
      expect(store.isAuthenticated).toBe(false)
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

    it('reports a key the account is no longer permitted to use, and keeps it', async () => {
      localStorage.setItem(STORAGE_KEY, VALID_KEY)
      mockCreateCustomer.mockRejectedValue(new AuthStoreError('denied', 403))

      const store = useApiKeyAuthStore()
      await vi.waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled())
      await nextTick()

      expect(store.isAuthenticated).toBe(false)
      expect(store.getApiKey()).toBe(VALID_KEY)
      expect(severities()).toEqual(['error:auth.apiKey.notPermitted'])
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
