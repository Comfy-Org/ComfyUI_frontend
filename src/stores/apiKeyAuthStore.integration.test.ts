import { respondToFetch } from '@comfyorg/test-utils/fetch'
import type { User } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'

const CUSTOMERS_URL = /\/customers$/

vi.mock(import('firebase/auth'))

vi.mock(
  import('@/platform/distribution/types'),
  () =>
    ({
      DISTRIBUTION: 'cloud',
      isCloud: true,
      isDesktop: false
    }) as const
)

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@comfyorg/telemetry/reportError'))

vi.mock(import('@/services/dialogService'))

describe('API key authentication initialization', () => {
  beforeEach(() => {
    localStorage.clear()
    respondToFetch(CUSTOMERS_URL, () =>
      Response.json({ id: 'test-customer-id' })
    )

    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      (_, callback) => {
        ;(callback as (user: User | null) => void)(null)
        return vi.fn()
      }
    )
    vi.mocked(firebaseAuth.onIdTokenChanged).mockReturnValue(vi.fn())
  })

  const customerResponse = (id: string) => Response.json({ id })

  const waitForCustomer = (
    apiKeyStore: ReturnType<typeof useApiKeyAuthStore>
  ) =>
    vi.waitFor(() =>
      expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    )

  const settleQueuedTasks = () => new Promise((resolve) => setTimeout(resolve))

  const initializeStoreWithPendingLookup = async () => {
    let settleLookup!: {
      resolve: (response: Response) => void
      reject: (reason: Error) => void
    }
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve, reject) => {
          settleLookup = { resolve, reject }
        })
    )
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    return { apiKeyStore, ...settleLookup }
  }

  it('retains and validates a persisted key while the API key store initializes', async () => {
    localStorage.setItem('comfy_api_key', 'persisted-api-key')
    useAuthStore()

    const apiKeyStore = useApiKeyAuthStore()

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())

    expect(apiKeyStore.getApiKey()).toBe('persisted-api-key')
    expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-KEY': 'persisted-api-key'
        })
      })
    )
  })

  it('keeps a key in memory when localStorage is blocked', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    expect(apiKeyStore.getApiKey()).toBeNull()

    await apiKeyStore.storeApiKey('memory-key')

    expect(apiKeyStore.getApiKey()).toBe('memory-key')
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'API Key saved for this session only'
      })
    )
    await vi.waitFor(() =>
      expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    )
  })

  it('says the key is session-only when localStorage rejects the write', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    await apiKeyStore.storeApiKey('memory-key')

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'API Key saved for this session only'
      })
    )
    await vi.waitFor(() =>
      expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    )
  })

  it('does not bring back a previously saved key when saving a new one fails', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    await apiKeyStore.storeApiKey('key-b')

    expect(apiKeyStore.getApiKey()).toBe('key-b')
    expect(localStorage.getItem('comfy_api_key')).toBeNull()
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        description:
          'Your browser could not save it, so the key will be cleared when you reload.'
      })
    )
    await waitForCustomer(apiKeyStore)
  })

  it('says the previous key returns after reload when it cannot be removed', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })

    await apiKeyStore.storeApiKey('key-b')

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        description:
          'Your browser could not save it. After you reload, your previously saved key will be used again.'
      })
    )
    await waitForCustomer(apiKeyStore)
  })

  it('keeps warning when the same unsaved key is submitted again', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    await apiKeyStore.storeApiKey('key-b')
    await apiKeyStore.storeApiKey('key-b')

    expect(useToast().toasts.at(-1)).toEqual(
      expect.objectContaining({ kind: 'warning' })
    )
    expect(localStorage.getItem('comfy_api_key')).toBeNull()
    await waitForCustomer(apiKeyStore)
  })

  it('does not mention a previous key on a first save that cannot be stored', async () => {
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })

    await apiKeyStore.storeApiKey('key-b')

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        description:
          'Your browser could not save it, so the key will be cleared when you reload.'
      })
    )
    await waitForCustomer(apiKeyStore)
  })

  it('does not persist the key after a one-time write failure', async () => {
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    await apiKeyStore.storeApiKey('key-b')
    await waitForCustomer(apiKeyStore)

    expect(localStorage.getItem('comfy_api_key')).toBeNull()
    expect(useToast().toasts.at(-1)).toEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'API Key saved for this session only'
      })
    )
  })

  it('follows a key saved in another tab', async () => {
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'comfy_api_key',
        newValue: 'other-tab-key',
        storageArea: localStorage
      })
    )

    expect(apiKeyStore.getApiKey()).toBe('other-tab-key')
    await waitForCustomer(apiKeyStore)
  })

  it('follows a key removed in another tab and ignores sessionStorage', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    await waitForCustomer(apiKeyStore)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'comfy_api_key',
        newValue: 'session-value',
        storageArea: sessionStorage
      })
    )
    expect(apiKeyStore.getApiKey()).toBe('key-a')

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'comfy_api_key',
        newValue: null,
        storageArea: localStorage
      })
    )
    expect(apiKeyStore.getApiKey()).toBeNull()
  })

  it('confirms a save normally once storage works again', async () => {
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    const setItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementationOnce(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      })
    await apiKeyStore.storeApiKey('key-a')
    setItem.mockRestore()

    await apiKeyStore.storeApiKey('key-b')

    expect(localStorage.getItem('comfy_api_key')).toBe('key-b')
    expect(useToast().toasts.at(-1)).toEqual(
      expect.objectContaining({ kind: 'success' })
    )
    await waitForCustomer(apiKeyStore)
  })

  it('removes the saved key when clearing it', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    await apiKeyStore.clearStoredApiKey()

    expect(localStorage.getItem('comfy_api_key')).toBeNull()
    expect(useToast().toasts.at(-1)).toEqual(
      expect.objectContaining({ kind: 'success' })
    )
  })

  it('warns that a saved key may return when it cannot be removed', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })

    await apiKeyStore.clearStoredApiKey()

    expect(apiKeyStore.getApiKey()).toBeNull()
    expect(useToast().toasts.at(-1)).toEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'API Key cleared for this session only'
      })
    )
  })

  it('warns that an earlier key may return when saving with storage blocked', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    await apiKeyStore.storeApiKey('key-b')

    expect(useToast().toasts.at(-1)).toEqual(
      expect.objectContaining({
        kind: 'warning',
        description:
          "Your browser is blocking site storage, so this key won't be kept after you reload. A key saved earlier may be used again if you re-enable storage."
      })
    )
    await waitForCustomer(apiKeyStore)
  })

  it('warns on clear when localStorage is blocked', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    await apiKeyStore.clearStoredApiKey()

    expect(useToast().toasts.at(-1)).toEqual(
      expect.objectContaining({
        kind: 'warning',
        description:
          'Your browser is blocking site storage. A key saved earlier may be used again if you re-enable storage.'
      })
    )
  })

  it('reports blocked storage once at startup', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    await apiKeyStore.storeApiKey('key-b')
    await apiKeyStore.clearStoredApiKey()

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      expect.any(DOMException),
      expect.objectContaining({ errorType: 'api_key_storage_failed' })
    )
  })

  it('sends one customer lookup for the replacement key when the key changes before initialization runs', async () => {
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    void apiKeyStore.storeApiKey('key-b')

    await vi.waitFor(() =>
      expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    )
    await settleQueuedTasks()

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-KEY': 'key-b' })
      })
    )
  })

  it('ignores a stale customer response after the key is replaced', async () => {
    const { apiKeyStore, resolve } = await initializeStoreWithPendingLookup()

    await apiKeyStore.storeApiKey('key-b')
    await vi.waitFor(() =>
      expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    )

    resolve(customerResponse('stale-customer-id'))
    await settleQueuedTasks()

    expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    expect(apiKeyStore.getApiKey()).toBe('key-b')
  })

  it('retains the replacement key when the stale lookup fails', async () => {
    const { apiKeyStore, reject } = await initializeStoreWithPendingLookup()

    await apiKeyStore.storeApiKey('key-b')
    await vi.waitFor(() =>
      expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    )

    reject(new Error('stale lookup failed'))
    await settleQueuedTasks()

    expect(apiKeyStore.getApiKey()).toBe('key-b')
    expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
  })

  it('keeps the user signed out when a pending lookup resolves after the key is cleared', async () => {
    const { apiKeyStore, resolve } = await initializeStoreWithPendingLookup()

    await apiKeyStore.clearStoredApiKey()
    resolve(customerResponse('stale-customer-id'))
    await settleQueuedTasks()

    expect(apiKeyStore.currentUser).toBeNull()
    expect(apiKeyStore.getApiKey()).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
  })

  describe('customer creation failure telemetry', () => {
    const failCustomerLookup = async (error: Error) => {
      localStorage.setItem('comfy_api_key', 'key-a')
      const authStore = useAuthStore()
      let rejectLookup!: (reason: Error) => void
      vi.spyOn(authStore, 'createCustomer').mockReturnValue(
        new Promise((_, reject) => {
          rejectLookup = reject
        })
      )
      const apiKeyStore = useApiKeyAuthStore()
      await vi.waitFor(() =>
        expect(authStore.createCustomer).toHaveBeenCalledOnce()
      )

      rejectLookup(error)
      void apiKeyStore.clearStoredApiKey()
    }

    it.for([
      { status: 401, error: new AuthStoreError('Unauthorized', 401) },
      { status: 403, error: new AuthStoreError('Forbidden', 403) }
    ])(
      'warns without reporting when the key is rejected with $status',
      async ({ error }) => {
        await failCustomerLookup(error)

        await vi.waitFor(() => expect(console.warn).toHaveBeenCalledWith(error))
        expect(reportError).not.toHaveBeenCalled()
      }
    )

    it.for([
      { name: 'a 500 response', error: new AuthStoreError('Server', 500) },
      { name: 'a plain Error', error: new Error('network down') }
    ])('reports $name', async ({ error }) => {
      await failCustomerLookup(error)

      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
          errorType: 'api_key_customer_creation_failure',
          surface: 'auth'
        })
      )
    })
  })
})
