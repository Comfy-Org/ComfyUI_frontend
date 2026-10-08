import { respondToFetch } from '@comfyorg/test-utils/fetch'
import type { User } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

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

vi.mock(import('@/platform/telemetry'))

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
})
