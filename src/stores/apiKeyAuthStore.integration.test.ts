import type { User } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import { createTestingPinia } from '@pinia/testing'
import type { Pinia } from 'pinia'
import { disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
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

  afterEach(() => {
    disposePinia(pinia)
  })

  const customerResponse = (id: string) => ({
    ok: true,
    statusText: 'OK',
    json: () => Promise.resolve({ id })
  })

  const settleQueuedTasks = () => new Promise((resolve) => setTimeout(resolve))

  const initializeStoreWithPendingLookup = async () => {
    let settleLookup!: {
      resolve: (response: unknown) => void
      reject: (reason: Error) => void
    }
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          settleLookup = { resolve, reject }
        })
    )
    localStorage.setItem('comfy_api_key', 'key-a')
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce())
    return { apiKeyStore, ...settleLookup }
  }

  it('does not finish saving until the server validates the key', async () => {
    const { apiKeyStore, resolve } = await initializeStoreWithPendingLookup()
    const saved = vi.fn()
    const saving = apiKeyStore.storeApiKey('key-a').then(saved)

    await settleQueuedTasks()

    expect(saved).not.toHaveBeenCalled()
    expect(apiKeyStore.currentUser).toBeNull()
    expect(mockFetch).toHaveBeenCalledOnce()

    resolve(customerResponse('verified-customer'))
    await saving

    expect(saved).toHaveBeenCalledWith(true)
    expect(apiKeyStore.currentUser).toEqual({ id: 'verified-customer' })
  })

  it.for([401, 403])(
    'does not accept a key rejected with HTTP %i',
    async (status) => {
      mockFetch.mockResolvedValueOnce({ ok: false, status })
      useAuthStore()
      const apiKeyStore = useApiKeyAuthStore()

      expect(await apiKeyStore.storeApiKey('rejected-key')).toBe(false)
      expect(apiKeyStore.currentUser).toBeNull()
      expect(apiKeyStore.getApiKey()).toBeNull()
    }
  )

  it('retains the key but does not sign in when verification is temporarily unavailable', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    expect(await apiKeyStore.storeApiKey('retryable-key')).toBe(false)
    expect(apiKeyStore.currentUser).toBeNull()
    expect(apiKeyStore.getApiKey()).toBe('retryable-key')
    expect(await apiKeyStore.storeApiKey('retryable-key')).toBe(true)
    expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not discard a key when its validation request is interrupted', async () => {
    const { apiKeyStore, reject } = await initializeStoreWithPendingLookup()
    const saving = apiKeyStore.storeApiKey('key-a')

    reject(new TypeError('Failed to fetch'))

    expect(await saving).toBe(false)
    expect(apiKeyStore.getApiKey()).toBe('key-a')
    expect(apiKeyStore.currentUser).toBeNull()
  })

  it('normalizes pasted whitespace before validating and storing the key', async () => {
    useAuthStore()
    const apiKeyStore = useApiKeyAuthStore()

    expect(await apiKeyStore.storeApiKey('  pasted-api-key  ')).toBe(true)
    expect(apiKeyStore.getApiKey()).toBe('pasted-api-key')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/user'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-KEY': 'pasted-api-key' })
      })
    )
  })

  it('does not revive an old lookup when the same key is selected again', async () => {
    const { apiKeyStore, resolve: resolveOld } =
      await initializeStoreWithPendingLookup()
    await apiKeyStore.storeApiKey('key-b')
    let resolveNew!: (response: unknown) => void
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNew = resolve
        })
    )
    const saving = apiKeyStore.storeApiKey('key-a')
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3))

    resolveOld(customerResponse('old-customer'))
    await settleQueuedTasks()

    expect(apiKeyStore.currentUser).toBeNull()
    expect(apiKeyStore.isValidating).toBe(true)

    resolveNew(customerResponse('new-customer'))
    expect(await saving).toBe(true)
    expect(apiKeyStore.currentUser).toEqual({ id: 'new-customer' })
  })

  it('validates a persisted Cloud key against the current Cloud user', async () => {
    localStorage.setItem('comfy_api_key', 'persisted-api-key')
    useAuthStore()

    const apiKeyStore = useApiKeyAuthStore()

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce())

    expect(apiKeyStore.getApiKey()).toBe('persisted-api-key')
    expect(apiKeyStore.currentUser).toEqual({ id: 'test-customer-id' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/user'),
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

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/user'),
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
    expect(mockFetch).toHaveBeenCalledOnce()
  })
})
