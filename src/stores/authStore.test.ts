import { FirebaseError } from 'firebase/app'
import type { User, UserCredential } from 'firebase/auth'
import * as firebaseAuth from 'firebase/auth'
import { setActivePinia } from 'pinia'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vuefire from 'vuefire'

import {
  capturePreservedQuery,
  clearPreservedQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import {
  cachedLegacyBillingMigrationEnabled,
  remoteConfig,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { useDialogService } from '@/services/dialogService'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import type * as ApiModule from '@/scripts/api'
import { api } from '@/scripts/api'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { createTestingPinia } from '@pinia/testing'

// Hoisted mocks for dynamic imports
const { mockDistributionTypes } = vi.hoisted(() => ({
  mockDistributionTypes: {
    isCloud: true,
    isDesktop: false,
    DISTRIBUTION: 'cloud'
  }
}))

const { mockFeatureFlags } = vi.hoisted(() => ({
  mockFeatureFlags: {
    unifiedCloudAuthEnabled: false
  }
}))

const { mockResetSocket } = vi.hoisted(() => ({
  mockResetSocket: vi.fn()
}))

const mockTeamWorkspaceStore = vi.hoisted(() => ({
  activeWorkspaceId: null as string | null,
  resetForIdentityChange: vi.fn()
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => mockTeamWorkspaceStore
}))

type MockUser = Omit<User, 'getIdToken' | 'delete'> & {
  getIdToken: Mock
  delete: Mock
}

type MockAuth = Record<string, unknown>

// Mock fetch
const mockFetch = vi.fn()

const customerRequestBody = (): Record<string, unknown> | undefined => {
  const customerCall = mockFetch.mock.calls.find(([url]) =>
    String(url).endsWith('/customers')
  )
  const body = customerCall?.[1]?.body
  return typeof body === 'string'
    ? (JSON.parse(body) as Record<string, unknown>)
    : undefined
}

// Mock successful API responses
const mockCreateCustomerResponse = {
  ok: true,
  statusText: 'OK',
  json: () => Promise.resolve({ id: 'test-customer-id' })
}

const mockFetchBalanceResponse = {
  ok: true,
  json: () => Promise.resolve({ balance: 0 })
}

const mockAddCreditsResponse = {
  ok: true,
  statusText: 'OK'
}

const mockAccessBillingPortalResponse = {
  ok: true,
  statusText: 'OK',
  json: () =>
    Promise.resolve({ billing_portal_url: 'https://billing.stripe.com/test' })
}

vi.mock('vuefire', () => ({
  useFirebaseAuth: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key
    }
  })
}))

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof firebaseAuth>()
  return {
    ...actual,
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    onIdTokenChanged: vi.fn(),
    signInWithPopup: vi.fn(),
    GoogleAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    },
    GithubAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    },
    getAdditionalUserInfo: vi.fn(),
    setPersistence: vi.fn().mockResolvedValue(undefined)
  }
})

// Mock telemetry
const mockTrackAuth = vi.fn()
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackAuth: mockTrackAuth
  })
}))

// Keep the real API singleton (other modules rely on its full surface) but
// override resetSocket so we can assert socket lifecycle calls without opening
// a real WebSocket.
vi.mock('@/scripts/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>()
  Object.assign(actual.api, { resetSocket: mockResetSocket })
  return actual
})

// Mock useDialogService
vi.mock('@/services/dialogService')
vi.mock('@/platform/distribution/types', () => mockDistributionTypes)
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFeatureFlags
  })
}))

// Mock apiKeyAuthStore
const mockApiKeyGetAuthHeader = vi.fn().mockReturnValue(null)
const mockApiKeyGetApiKey = vi.fn()
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({
    getAuthHeader: mockApiKeyGetAuthHeader,
    getApiKey: mockApiKeyGetApiKey,
    currentUser: null,
    isAuthenticated: false,
    storeApiKey: vi.fn(),
    clearStoredApiKey: vi.fn()
  })
}))

describe('useAuthStore', () => {
  let store: ReturnType<typeof useAuthStore>
  let authStateCallback: (user: User | null) => void
  let idTokenCallback: (user: User | null) => void

  const mockAuth: MockAuth = {/* mock Auth object */}

  const mockUser: MockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    delete: vi.fn().mockResolvedValue(undefined)
  } as Partial<User> as MockUser

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.SHARE_AUTH)

    mockFeatureFlags.unifiedCloudAuthEnabled = false

    // Setup dialog service mock
    vi.mocked(useDialogService, { partial: true }).mockReturnValue({
      showErrorDialog: vi.fn()
    })

    // Mock useFirebaseAuth to return our mock auth object
    vi.mocked(vuefire.useFirebaseAuth).mockReturnValue(
      mockAuth as Partial<
        ReturnType<typeof vuefire.useFirebaseAuth>
      > as ReturnType<typeof vuefire.useFirebaseAuth>
    )

    // Mock onAuthStateChanged to capture the callback and simulate initial auth state
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      (_, callback) => {
        authStateCallback = callback as (user: User | null) => void
        // Call the callback with our mock user
        ;(callback as (user: User | null) => void)(mockUser)
        // Return an unsubscribe function
        return vi.fn()
      }
    )

    // Mock fetch responses
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith('/customers')) {
        return Promise.resolve(mockCreateCustomerResponse)
      }
      if (url.endsWith('/customers/balance')) {
        return Promise.resolve(mockFetchBalanceResponse)
      }
      if (url.endsWith('/customers/credit')) {
        return Promise.resolve(mockAddCreditsResponse)
      }
      if (url.endsWith('/customers/billing')) {
        return Promise.resolve(mockAccessBillingPortalResponse)
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    store = useAuthStore()

    // Reset and set up getIdToken mock
    mockUser.getIdToken.mockResolvedValue('mock-id-token')

    // Default: no API key auth
    mockApiKeyGetAuthHeader.mockReturnValue(null)
    mockApiKeyGetApiKey.mockReturnValue(null)
    mockTeamWorkspaceStore.activeWorkspaceId = null
    mockTeamWorkspaceStore.resetForIdentityChange.mockReset()
  })

  describe('token refresh events', () => {
    beforeEach(async () => {
      vi.resetModules()

      vi.mocked(firebaseAuth.onIdTokenChanged).mockImplementation(
        (_auth, callback) => {
          idTokenCallback = callback as (user: User | null) => void
          return vi.fn()
        }
      )

      vi.mocked(vuefire.useFirebaseAuth).mockReturnValue(
        mockAuth as Partial<
          ReturnType<typeof vuefire.useFirebaseAuth>
        > as ReturnType<typeof vuefire.useFirebaseAuth>
      )

      setActivePinia(createTestingPinia({ stubActions: false }))
      const storeModule = await import('@/stores/authStore')
      store = storeModule.useAuthStore()
    })

    it("should not increment tokenRefreshTrigger on the user's first ID token event", () => {
      idTokenCallback?.(mockUser)
      expect(store.tokenRefreshTrigger).toBe(0)
    })

    it('should increment tokenRefreshTrigger on subsequent ID token events for the same user', () => {
      idTokenCallback?.(mockUser)
      idTokenCallback?.(mockUser)
      expect(store.tokenRefreshTrigger).toBe(1)
    })

    it('should not increment when ID token event is for a different user UID', () => {
      const otherUser = { uid: 'other-user-id' } as Partial<User> as User
      idTokenCallback?.(mockUser)
      idTokenCallback?.(otherUser)
      expect(store.tokenRefreshTrigger).toBe(0)
    })

    it('should increment after switching to a new UID and receiving a second event for that UID', () => {
      const otherUser = { uid: 'other-user-id' } as Partial<User> as User
      idTokenCallback?.(mockUser)
      idTokenCallback?.(otherUser)
      idTokenCallback?.(otherUser)
      expect(store.tokenRefreshTrigger).toBe(1)
    })

    it('does not increment on a Firebase token refresh when unified_cloud_auth is ON', () => {
      mockFeatureFlags.unifiedCloudAuthEnabled = true
      idTokenCallback?.(mockUser) // initial event (always skipped)
      idTokenCallback?.(mockUser) // refresh — gated off; the unified lifecycle drives rotation
      expect(store.tokenRefreshTrigger).toBe(0)
    })

    it('notifyTokenRefreshed increments the rotation trigger (unified rotation driver)', () => {
      store.notifyTokenRefreshed()
      expect(store.tokenRefreshTrigger).toBe(1)
    })
  })

  it('should initialize with the current user', () => {
    expect(store.currentUser).toEqual(mockUser)
    expect(store.isAuthenticated).toBe(true)
    expect(store.userEmail).toBe('test@example.com')
    expect(store.userId).toBe('test-user-id')
    expect(store.loading).toBe(false)
  })

  it('should set persistence to local storage on initialization', () => {
    expect(firebaseAuth.setPersistence).toHaveBeenCalledWith(
      mockAuth,
      firebaseAuth.browserLocalPersistence
    )
  })

  it('should properly clean up error state between operations', async () => {
    // First, cause an error
    const mockError = new Error('Invalid password')
    vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockRejectedValueOnce(
      mockError
    )

    try {
      await store.login('test@example.com', 'wrong-password')
    } catch (e) {
      // Error expected
    }

    // Now, succeed on next attempt
    vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValueOnce({
      user: mockUser
    } as Partial<UserCredential> as UserCredential)

    await store.login('test@example.com', 'correct-password')
  })

  describe('fetchBalance identity isolation', () => {
    it('discards a late balance response from the previous account after an A->B switch', async () => {
      let signalBalanceRequested: () => void = () => {}
      const balanceRequested = new Promise<void>((resolve) => {
        signalBalanceRequested = resolve
      })
      let resolveBalanceJson: (value: unknown) => void = () => {}
      const balanceJson = new Promise((resolve) => {
        resolveBalanceJson = resolve
      })
      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('/customers/balance')) {
          signalBalanceRequested()
          return Promise.resolve({ ok: true, json: () => balanceJson })
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      // Request starts while account A is current.
      const pending = store.fetchBalance()
      await balanceRequested

      // Firebase transitions directly to account B before the response lands.
      authStateCallback({ ...mockUser, uid: 'account-b' } as User)
      resolveBalanceJson({ balance: 4242 })

      expect(await pending).toBeNull()
      expect(store.balance).toBeNull()
    })
  })

  describe('user-scoped billing endpoints with API-key sessions', () => {
    beforeEach(() => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'test-api-key' })
      mockApiKeyGetApiKey.mockReturnValue('test-api-key')
    })

    it('fetchBalance sends the stored API key when no Firebase user exists', async () => {
      const result = await store.fetchBalance()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/balance'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-API-KEY': 'test-api-key' })
        })
      )
      expect(result).toEqual({ balance: 0 })
    })

    it('fetchBalance throws userNotAuthenticated when neither credential exists', async () => {
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(store.fetchBalance()).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('drops a late balance response after the API key changes mid-flight', async () => {
      let resolveBalance!: (value: unknown) => void
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveBalance = resolve
        })
      )

      const request = store.fetchBalance()
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      resolveBalance({ ok: true, json: () => Promise.resolve({ balance: 7 }) })

      await expect(request).resolves.toBeNull()
      expect(store.balance).toBeNull()
    })

    it('fetchBalance prefers the Firebase token over the API key when signed in', async () => {
      authStateCallback(mockUser as User)

      await store.fetchBalance()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/balance'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-id-token'
          })
        })
      )
      expect(mockApiKeyGetAuthHeader).not.toHaveBeenCalled()
    })

    it('initiateCreditPurchase sends the stored API key when no Firebase user exists', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('/customers')) {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        if (url.endsWith('/customers/credit')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ checkout_url: 'https://stripe.test/checkout' })
          })
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      await store.initiateCreditPurchase({
        amount_micros: 5_000_000,
        currency: 'usd'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/credit'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-API-KEY': 'test-api-key' })
        })
      )
    })

    it('accessBillingPortal sends the stored API key when no Firebase user exists', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ billing_portal_url: 'https://stripe.test/portal' })
      })

      await store.accessBillingPortal()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/billing'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-API-KEY': 'test-api-key' })
        })
      )
    })

    it('accessBillingPortal throws userNotAuthenticated when neither credential exists', async () => {
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(store.accessBillingPortal()).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })
    it('re-provisions the customer after the API key changes', async () => {
      let customerPostCount = 0
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          customerPostCount++
          return Promise.resolve(mockCreateCustomerResponse)
        }
        if (url.endsWith('/customers/credit')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ checkout_url: 'https://stripe.test/checkout' })
          })
        }
        return Promise.reject(new Error('Unexpected API call'))
      })
      const payload = { amount_micros: 5_000_000, currency: 'usd' }

      await store.initiateCreditPurchase(payload)
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      await store.initiateCreditPurchase(payload)

      expect(customerPostCount).toBe(2)
    })

    it('does not retry with the old API key after a mid-recovery switch', async () => {
      const missingCustomerResponse = {
        ok: false,
        status: 409,
        clone: () => ({
          json: () => Promise.resolve({ message: 'Failed to find customer' })
        }),
        json: () => Promise.resolve({ message: 'Failed to find customer' }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ message: 'Failed to find customer' })
          )
      }
      let resolveCreate!: (value: unknown) => void
      let billingCallCount = 0
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return new Promise((resolve) => {
            resolveCreate = resolve
          })
        }
        if (url.endsWith('/customers/billing')) {
          billingCallCount++
          return Promise.resolve(missingCustomerResponse)
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      const request = store.accessBillingPortal()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      resolveCreate(mockCreateCustomerResponse)

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
      expect(billingCallCount).toBe(1)
    })

    it('aborts a credit purchase when the API key changes during recovery', async () => {
      let resolveCreate!: (value: unknown) => void
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return new Promise((resolve) => {
            resolveCreate = resolve
          })
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      const request = store.initiateCreditPurchase({
        amount_micros: 5_000_000,
        currency: 'usd'
      })
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      resolveCreate(mockCreateCustomerResponse)

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
      expect(
        mockFetch.mock.calls.some(([url]) =>
          String(url).endsWith('/customers/credit')
        )
      ).toBe(false)
    })

    it('withholds a portal URL that succeeds after an A->B API key switch', async () => {
      let resolveBilling!: (value: unknown) => void
      const billingRequestStarted = new Promise<void>((requestStarted) => {
        mockFetch.mockImplementation((url: string) => {
          if (url.endsWith('/customers/billing')) {
            requestStarted()
            return new Promise((resolve) => {
              resolveBilling = resolve
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.accessBillingPortal()
      await billingRequestStarted
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      resolveBilling({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ billing_portal_url: 'https://stripe.test/portal' })
      })

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
    })

    it('withholds a checkout URL that succeeds after an A->B API key switch', async () => {
      let resolveCredit!: (value: unknown) => void
      const creditRequestStarted = new Promise<void>((requestStarted) => {
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (url.endsWith('/customers') && init?.method === 'POST') {
            return Promise.resolve(mockCreateCustomerResponse)
          }
          if (url.endsWith('/customers/credit')) {
            requestStarted()
            return new Promise((resolve) => {
              resolveCredit = resolve
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.initiateCreditPurchase({
        amount_micros: 5_000_000,
        currency: 'usd'
      })
      await creditRequestStarted
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      resolveCredit({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ checkout_url: 'https://stripe.test/checkout' })
      })

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
    })

    it('rejects a customer record created before an A->B API key switch', async () => {
      let resolveCreate!: (value: unknown) => void
      const createRequestStarted = new Promise<void>((requestStarted) => {
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (url.endsWith('/customers') && init?.method === 'POST') {
            requestStarted()
            return new Promise((resolve) => {
              resolveCreate = resolve
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.createCustomer()
      await createRequestStarted
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      resolveCreate(mockCreateCustomerResponse)

      await expect(request).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
    })

    it('withholds a portal URL when the API key changes while the body parses', async () => {
      let resolvePortalBody!: (value: unknown) => void
      const bodyParsingStarted = new Promise<void>((parsingStarted) => {
        mockFetch.mockImplementation((url: string) => {
          if (url.endsWith('/customers/billing')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => {
                parsingStarted()
                return new Promise((resolve) => {
                  resolvePortalBody = resolve
                })
              }
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.accessBillingPortal()
      await bodyParsingStarted
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      resolvePortalBody({ billing_portal_url: 'https://stripe.test/portal' })

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
    })

    it('withholds a checkout URL when the API key changes while the body parses', async () => {
      let resolveCreditBody!: (value: unknown) => void
      const bodyParsingStarted = new Promise<void>((parsingStarted) => {
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (url.endsWith('/customers') && init?.method === 'POST') {
            return Promise.resolve(mockCreateCustomerResponse)
          }
          if (url.endsWith('/customers/credit')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => {
                parsingStarted()
                return new Promise((resolve) => {
                  resolveCreditBody = resolve
                })
              }
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.initiateCreditPurchase({
        amount_micros: 5_000_000,
        currency: 'usd'
      })
      await bodyParsingStarted
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
      resolveCreditBody({ checkout_url: 'https://stripe.test/checkout' })

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
    })

    const accountAFailureResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      clone: () => ({
        json: () => Promise.resolve({ message: 'account A backend error' })
      }),
      json: () => Promise.resolve({ message: 'account A backend error' }),
      text: () =>
        Promise.resolve(JSON.stringify({ message: 'account A backend error' }))
    }

    const switchToAnotherApiKey = () => {
      mockApiKeyGetApiKey.mockReturnValue('another-api-key')
      mockApiKeyGetAuthHeader.mockReturnValue({
        'X-API-KEY': 'another-api-key'
      })
    }

    it('suppresses a balance error that rejects after an A->B API key switch', async () => {
      let resolveBalance!: (value: unknown) => void
      const balanceRequestStarted = new Promise<void>((requestStarted) => {
        mockFetch.mockImplementation((url: string) => {
          if (url.endsWith('/customers/balance')) {
            requestStarted()
            return new Promise((resolve) => {
              resolveBalance = resolve
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.fetchBalance()
      await balanceRequestStarted
      switchToAnotherApiKey()
      resolveBalance(accountAFailureResponse)

      await expect(request).resolves.toBeNull()
      expect(store.balance).toBeNull()
    })

    it('withholds a checkout error that rejects after an A->B API key switch', async () => {
      let resolveCredit!: (value: unknown) => void
      const creditRequestStarted = new Promise<void>((requestStarted) => {
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (url.endsWith('/customers') && init?.method === 'POST') {
            return Promise.resolve(mockCreateCustomerResponse)
          }
          if (url.endsWith('/customers/credit')) {
            requestStarted()
            return new Promise((resolve) => {
              resolveCredit = resolve
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.initiateCreditPurchase({
        amount_micros: 5_000_000,
        currency: 'usd'
      })
      await creditRequestStarted
      switchToAnotherApiKey()
      resolveCredit(accountAFailureResponse)

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
    })

    it('withholds a portal error that rejects after an A->B API key switch', async () => {
      let resolveBilling!: (value: unknown) => void
      const billingRequestStarted = new Promise<void>((requestStarted) => {
        mockFetch.mockImplementation((url: string) => {
          if (url.endsWith('/customers/billing')) {
            requestStarted()
            return new Promise((resolve) => {
              resolveBilling = resolve
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.accessBillingPortal()
      await billingRequestStarted
      switchToAnotherApiKey()
      resolveBilling(accountAFailureResponse)

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
    })

    it('withholds a customer-creation error that rejects after an A->B API key switch', async () => {
      let resolveCreate!: (value: unknown) => void
      const createRequestStarted = new Promise<void>((requestStarted) => {
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (url.endsWith('/customers') && init?.method === 'POST') {
            requestStarted()
            return new Promise((resolve) => {
              resolveCreate = resolve
            })
          }
          return Promise.reject(new Error('Unexpected API call'))
        })
      })

      const request = store.createCustomer()
      await createRequestStarted
      switchToAnotherApiKey()
      resolveCreate(accountAFailureResponse)

      await expect(request).rejects.toMatchObject({
        message: 'toastMessages.userNotAuthenticated'
      })
    })
  })

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const mockUserCredential = { user: mockUser }
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential as Partial<UserCredential> as UserCredential
      )

      const result = await store.login('test@example.com', 'password')

      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password'
      )
      expect(result).toEqual(mockUserCredential)
      expect(store.loading).toBe(false)
    })

    it('should handle login errors', async () => {
      const mockError = new Error('Invalid password')
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockRejectedValue(
        mockError
      )

      await expect(
        store.login('test@example.com', 'wrong-password')
      ).rejects.toThrow('Invalid password')

      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'wrong-password'
      )
      expect(store.loading).toBe(false)
    })

    it('should handle concurrent login attempts correctly', async () => {
      // Set up multiple login promises
      const mockUserCredential = { user: mockUser }
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential as Partial<UserCredential> as UserCredential
      )

      const loginPromise1 = store.login('user1@example.com', 'password1')
      const loginPromise2 = store.login('user2@example.com', 'password2')

      // Resolve both promises
      await Promise.all([loginPromise1, loginPromise2])

      // Verify the loading state is reset
      expect(store.loading).toBe(false)
    })
  })

  describe('register', () => {
    it('should register a new user', async () => {
      const mockUserCredential = { user: mockUser }
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        mockUserCredential as Partial<UserCredential> as UserCredential
      )

      const result = await store.register('new@example.com', 'password')

      expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'new@example.com',
        'password'
      )
      expect(result).toEqual(mockUserCredential)
      expect(store.loading).toBe(false)
    })

    it('should handle registration errors', async () => {
      const mockError = new Error('Email already in use')
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockRejectedValue(
        mockError
      )

      await expect(
        store.register('existing@example.com', 'password')
      ).rejects.toThrow('Email already in use')

      expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'existing@example.com',
        'password'
      )
      expect(store.loading).toBe(false)
    })

    it('forwards the turnstile token to createCustomer as turnstile_token', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser
      } as Partial<UserCredential> as UserCredential)

      await store.register('new@example.com', 'password', 'turnstile-abc')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            turnstile_token: 'turnstile-abc',
            signup_source: 'cloud'
          })
        })
      )
    })

    it('omits turnstile_token when no turnstile token is provided', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser
      } as Partial<UserCredential> as UserCredential)

      await store.register('new@example.com', 'password')

      expect(customerRequestBody()).toEqual({ signup_source: 'cloud' })
    })

    it('rolls back the orphaned Firebase user when customer creation fails', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser
      } as Partial<UserCredential> as UserCredential)
      // The server-side customer creation (where Turnstile is validated) fails.
      mockFetch.mockImplementation((url: string) =>
        url.endsWith('/customers')
          ? Promise.resolve({
              ok: false,
              statusText: 'Forbidden',
              json: () => Promise.resolve({})
            })
          : Promise.reject(new Error('Unexpected API call'))
      )

      await expect(
        store.register('new@example.com', 'password', 'turnstile-bad')
      ).rejects.toThrow()

      // The just-created user is deleted so the email is freed for retry.
      expect(mockUser.delete).toHaveBeenCalledTimes(1)
    })

    it('does not delete the user on a successful registration', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser
      } as Partial<UserCredential> as UserCredential)

      await store.register('new@example.com', 'password')

      expect(mockUser.delete).not.toHaveBeenCalled()
    })

    it('does not delete an existing user when customer creation fails during login', async () => {
      // Regression guard: the rollback must be scoped to register only — login
      // signs in an EXISTING user, so a customer hiccup must never delete it.
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser
      } as Partial<UserCredential> as UserCredential)
      mockFetch.mockImplementation((url: string) =>
        url.endsWith('/customers')
          ? Promise.resolve({
              ok: false,
              statusText: 'Forbidden',
              json: () => Promise.resolve({})
            })
          : Promise.reject(new Error('Unexpected API call'))
      )

      await expect(
        store.login('test@example.com', 'password')
      ).rejects.toThrow()
      expect(mockUser.delete).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('should sign out the user', async () => {
      vi.mocked(firebaseAuth.signOut).mockResolvedValue(undefined)

      await store.logout()

      expect(firebaseAuth.signOut).toHaveBeenCalledWith(mockAuth)
    })

    it('should handle logout errors', async () => {
      const mockError = new Error('Network error')
      vi.mocked(firebaseAuth.signOut).mockRejectedValue(mockError)

      await expect(store.logout()).rejects.toThrow('Network error')

      expect(firebaseAuth.signOut).toHaveBeenCalledWith(mockAuth)
    })
  })

  describe('getIdToken', () => {
    it('should return the user ID token', async () => {
      // FIX 2: Reset the mock and set a specific return value
      mockUser.getIdToken.mockReset()
      mockUser.getIdToken.mockResolvedValue('mock-id-token')

      const token = await store.getIdToken()

      expect(mockUser.getIdToken).toHaveBeenCalled()
      expect(token).toBe('mock-id-token')
    })

    it('should return null when no user is logged in', async () => {
      // Simulate logged out state
      authStateCallback(null)

      const token = await store.getIdToken()

      expect(token).toBeUndefined()
    })

    it('discards a token that resolves after the account changes', async () => {
      let resolveToken: (token: string) => void = () => {}
      mockUser.getIdToken.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveToken = resolve
        })
      )
      const tokenPromise = store.getIdToken()
      const nextUser = {
        ...mockUser,
        uid: 'different-user-id',
        email: 'different@example.com',
        getIdToken: vi.fn().mockResolvedValue('different-user-token')
      } as MockUser

      authStateCallback(nextUser)
      resolveToken('old-user-token')

      await expect(tokenPromise).resolves.toBeUndefined()
    })

    it('should return null for token after login and logout sequence', async () => {
      // Setup mock for login
      const mockUserCredential = { user: mockUser }
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential as Partial<UserCredential> as UserCredential
      )

      // Login
      await store.login('test@example.com', 'password')

      // Simulate successful auth state update after login
      authStateCallback(mockUser)

      // Verify we're logged in and can get a token
      mockUser.getIdToken.mockReset()
      mockUser.getIdToken.mockResolvedValue('mock-id-token')
      expect(await store.getIdToken()).toBe('mock-id-token')

      // Setup mock for logout
      vi.mocked(firebaseAuth.signOut).mockResolvedValue(undefined)

      // Logout
      await store.logout()

      // Simulate successful auth state update after logout
      authStateCallback(null)

      // Verify token is null after logout
      const tokenAfterLogout = await store.getIdToken()
      expect(tokenAfterLogout).toBeUndefined()
    })

    it('should handle network errors gracefully when offline (reproduces issue #4468)', async () => {
      // This test reproduces the issue where Firebase Auth makes network requests when offline
      // and fails without graceful error handling, causing toast error messages

      // Simulate a user with an expired token that requires network refresh
      mockUser.getIdToken.mockReset()

      // Mock network failure (auth/network-request-failed error from Firebase)
      const networkError = new FirebaseError(
        firebaseAuth.AuthErrorCodes.NETWORK_REQUEST_FAILED,
        'mock error'
      )

      mockUser.getIdToken.mockRejectedValue(networkError)

      const token = await store.getIdToken()
      expect(token).toBeUndefined() // Should return undefined instead of throwing
    })

    it('should show error dialog when getIdToken fails with non-network error', async () => {
      // This test verifies that non-network errors trigger the error dialog
      mockUser.getIdToken.mockReset()

      // Mock a non-network error using actual Firebase Auth error code
      const authError = new FirebaseError(
        firebaseAuth.AuthErrorCodes.USER_DISABLED,
        'User account is disabled.'
      )

      mockUser.getIdToken.mockRejectedValue(authError)

      // Should call the error dialog instead of throwing
      const token = await store.getIdToken()
      const dialogService = useDialogService()

      expect(dialogService.showErrorDialog).toHaveBeenCalledWith(authError, {
        title: 'errorDialog.defaultTitle',
        reportType: 'authenticationError'
      })
      expect(token).toBeUndefined()
    })
  })

  describe('getAuthHeader', () => {
    it('should handle network errors gracefully when getting Firebase token (reproduces issue #4468)', async () => {
      // This test reproduces the issue where getAuthHeader fails due to network errors
      // when Firebase Auth tries to refresh tokens offline

      // Setup user with network error on token refresh
      mockUser.getIdToken.mockReset()
      const networkError = new FirebaseError(
        firebaseAuth.AuthErrorCodes.NETWORK_REQUEST_FAILED,
        'mock error'
      )
      mockUser.getIdToken.mockRejectedValue(networkError)

      const authHeader = await store.getAuthHeader()
      expect(authHeader).toBeNull() // Should fallback gracefully
    })
  })

  describe('getAuthHeader workspace recovery', () => {
    it('uses the workspace header when a valid workspace token exists', async () => {
      const workspaceAuth = useWorkspaceAuthStore()
      vi.spyOn(workspaceAuth, 'getWorkspaceAuthHeader').mockReturnValue({
        Authorization: 'Bearer ws-token'
      })

      const header = await store.getAuthHeader()

      expect(header).toEqual({ Authorization: 'Bearer ws-token' })
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('recovers the workspace token instead of downgrading to personal auth', async () => {
      const workspaceAuth = useWorkspaceAuthStore()
      mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-123'
      vi.spyOn(workspaceAuth, 'getWorkspaceAuthHeader').mockReturnValue(null)
      const ensureSpy = vi
        .spyOn(workspaceAuth, 'ensureWorkspaceAuthHeader')
        .mockResolvedValue({ Authorization: 'Bearer recovered-ws-token' })

      const header = await store.getAuthHeader()

      expect(ensureSpy).toHaveBeenCalledWith('workspace-123')
      expect(header).toEqual({ Authorization: 'Bearer recovered-ws-token' })
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('fails closed (no personal Firebase downgrade) when recovery yields no token', async () => {
      const workspaceAuth = useWorkspaceAuthStore()
      mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-123'
      vi.spyOn(workspaceAuth, 'getWorkspaceAuthHeader').mockReturnValue(null)
      vi.spyOn(workspaceAuth, 'ensureWorkspaceAuthHeader').mockResolvedValue(
        null
      )

      const header = await store.getAuthHeader()

      expect(header).toBeNull()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('falls back to Firebase when workspace mode is not yet initialized', async () => {
      const workspaceAuth = useWorkspaceAuthStore()
      mockTeamWorkspaceStore.activeWorkspaceId = null
      vi.spyOn(workspaceAuth, 'getWorkspaceAuthHeader').mockReturnValue(null)
      const ensureSpy = vi.spyOn(workspaceAuth, 'ensureWorkspaceAuthHeader')

      const header = await store.getAuthHeader()

      expect(ensureSpy).not.toHaveBeenCalled()
      expect(header).toEqual({ Authorization: 'Bearer mock-id-token' })
    })
  })

  describe('getAuthToken workspace recovery', () => {
    it('recovers the workspace token instead of downgrading to personal auth', async () => {
      const workspaceAuth = useWorkspaceAuthStore()
      mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-123'
      const ensureSpy = vi
        .spyOn(workspaceAuth, 'ensureWorkspaceToken')
        .mockResolvedValue('recovered-ws-token')

      const token = await store.getAuthToken()

      expect(ensureSpy).toHaveBeenCalledWith('workspace-123')
      expect(token).toBe('recovered-ws-token')
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('fails closed (no personal Firebase downgrade) when recovery yields no token', async () => {
      const workspaceAuth = useWorkspaceAuthStore()
      mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-123'
      vi.spyOn(workspaceAuth, 'ensureWorkspaceToken').mockResolvedValue(null)

      const token = await store.getAuthToken()

      expect(token).toBeUndefined()
      expect(mockUser.getIdToken).not.toHaveBeenCalled()
    })

    it('falls back to Firebase when workspace mode is not yet initialized', async () => {
      const workspaceAuth = useWorkspaceAuthStore()
      mockTeamWorkspaceStore.activeWorkspaceId = null
      vi.spyOn(workspaceAuth, 'getWorkspaceToken').mockReturnValue(undefined)
      const ensureSpy = vi.spyOn(workspaceAuth, 'ensureWorkspaceToken')

      const token = await store.getAuthToken()

      expect(ensureSpy).not.toHaveBeenCalled()
      expect(token).toBe('mock-id-token')
    })
  })

  describe('social authentication', () => {
    describe('loginWithGoogle', () => {
      it('should sign in with Google', async () => {
        const mockUserCredential = { user: mockUser }
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          mockUserCredential as Partial<UserCredential> as UserCredential
        )

        const result = await store.loginWithGoogle()

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalledWith(
          mockAuth,
          expect.any(firebaseAuth.GoogleAuthProvider)
        )
        expect(result).toEqual(mockUserCredential)
        expect(store.loading).toBe(false)
      })

      it('never sends a turnstile_token on the customer request (OAuth is exempt)', async () => {
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue({
          user: mockUser
        } as Partial<UserCredential> as UserCredential)

        await store.loginWithGoogle()

        expect(customerRequestBody()).toEqual({ signup_source: 'cloud' })
      })

      it('should handle Google sign in errors', async () => {
        const mockError = new Error('Google authentication failed')
        vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(mockError)

        await expect(store.loginWithGoogle()).rejects.toThrow(
          'Google authentication failed'
        )

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalledWith(
          mockAuth,
          expect.any(firebaseAuth.GoogleAuthProvider)
        )
        expect(store.loading).toBe(false)
      })
    })

    describe('loginWithGithub', () => {
      it('should sign in with Github', async () => {
        const mockUserCredential = { user: mockUser }
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          mockUserCredential as Partial<UserCredential> as UserCredential
        )

        const result = await store.loginWithGithub()

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalledWith(
          mockAuth,
          expect.any(firebaseAuth.GithubAuthProvider)
        )
        expect(result).toEqual(mockUserCredential)
        expect(store.loading).toBe(false)
      })

      it('never sends a turnstile_token on the customer request (OAuth is exempt)', async () => {
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue({
          user: mockUser
        } as Partial<UserCredential> as UserCredential)

        await store.loginWithGithub()

        expect(customerRequestBody()).toEqual({ signup_source: 'cloud' })
      })

      it('should handle Github sign in errors', async () => {
        const mockError = new Error('Github authentication failed')
        vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(mockError)

        await expect(store.loginWithGithub()).rejects.toThrow(
          'Github authentication failed'
        )

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalledWith(
          mockAuth,
          expect.any(firebaseAuth.GithubAuthProvider)
        )
        expect(store.loading).toBe(false)
      })
    })

    it('should handle concurrent social login attempts correctly', async () => {
      const mockUserCredential = { user: mockUser }
      vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
        mockUserCredential as Partial<UserCredential> as UserCredential
      )

      const googleLoginPromise = store.loginWithGoogle()
      const githubLoginPromise = store.loginWithGithub()

      await Promise.all([googleLoginPromise, githubLoginPromise])

      expect(store.loading).toBe(false)
    })

    describe('sign-up telemetry OR logic', () => {
      const mockUserCredential = {
        user: mockUser
      } as Partial<UserCredential> as UserCredential

      beforeEach(() => {
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          mockUserCredential
        )
      })

      it.for(['loginWithGoogle', 'loginWithGithub'] as const)(
        '%s should track is_new_user=true when Firebase says new user',
        async (method) => {
          vi.mocked(firebaseAuth.getAdditionalUserInfo).mockReturnValue({
            isNewUser: true,
            providerId: 'google.com',
            profile: null
          })

          await store[method]()

          expect(mockTrackAuth).toHaveBeenCalledWith(
            expect.objectContaining({ is_new_user: true })
          )
        }
      )

      it.for(['loginWithGoogle', 'loginWithGithub'] as const)(
        '%s should track is_new_user=true when UI options say new user',
        async (method) => {
          vi.mocked(firebaseAuth.getAdditionalUserInfo).mockReturnValue({
            isNewUser: false,
            providerId: 'google.com',
            profile: null
          })

          await store[method]({ isNewUser: true })

          expect(mockTrackAuth).toHaveBeenCalledWith(
            expect.objectContaining({ is_new_user: true })
          )
        }
      )

      it.for(['loginWithGoogle', 'loginWithGithub'] as const)(
        '%s should track is_new_user=false when neither source says new user',
        async (method) => {
          vi.mocked(firebaseAuth.getAdditionalUserInfo).mockReturnValue({
            isNewUser: false,
            providerId: 'google.com',
            profile: null
          })

          await store[method]()

          expect(mockTrackAuth).toHaveBeenCalledWith(
            expect.objectContaining({ is_new_user: false })
          )
        }
      )

      it.for(['loginWithGoogle', 'loginWithGithub'] as const)(
        '%s should track is_new_user=false when getAdditionalUserInfo returns null',
        async (method) => {
          vi.mocked(firebaseAuth.getAdditionalUserInfo).mockReturnValue(null)

          await store[method]()

          expect(mockTrackAuth).toHaveBeenCalledWith(
            expect.objectContaining({ is_new_user: false })
          )
        }
      )
    })
  })

  describe('share auth attribution', () => {
    const mockUserCredential = {
      user: mockUser,
      providerId: null,
      operationType: 'signIn'
    } satisfies UserCredential

    const preserveShareAuth = () => {
      capturePreservedQuery(
        PRESERVED_QUERY_NAMESPACES.SHARE_AUTH,
        { share: 'share-1' },
        ['share']
      )
    }

    const expectShareAuthConsumed = () => {
      expect(
        sessionStorage.getItem('Comfy.PreservedQuery.share_auth')
      ).toBeNull()
    }

    beforeEach(() => {
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential
      )
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        mockUserCredential
      )
      vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
        mockUserCredential
      )
      vi.mocked(firebaseAuth.getAdditionalUserInfo).mockReturnValue({
        isNewUser: true,
        providerId: 'google.com',
        profile: null
      })
    })

    it('includes share_id on email signup auth completion', async () => {
      preserveShareAuth()

      await store.register('new@example.com', 'password')

      expect(mockTrackAuth).toHaveBeenCalledWith({
        method: 'email',
        is_new_user: true,
        user_id: 'test-user-id',
        email: 'test@example.com',
        share_id: 'share-1'
      })
      expectShareAuthConsumed()
    })

    it('includes share_id on email login auth completion', async () => {
      preserveShareAuth()

      await store.login('test@example.com', 'password')

      expect(mockTrackAuth).toHaveBeenCalledWith({
        method: 'email',
        is_new_user: false,
        user_id: 'test-user-id',
        email: 'test@example.com',
        share_id: 'share-1'
      })
      expectShareAuthConsumed()
    })

    it('includes share_id on Google auth completion', async () => {
      preserveShareAuth()

      await store.loginWithGoogle()

      expect(mockTrackAuth).toHaveBeenCalledWith({
        method: 'google',
        is_new_user: true,
        user_id: 'test-user-id',
        email: 'test@example.com',
        share_id: 'share-1'
      })
      expectShareAuthConsumed()
    })

    it('includes share_id on GitHub auth completion', async () => {
      preserveShareAuth()

      await store.loginWithGithub()

      expect(mockTrackAuth).toHaveBeenCalledWith({
        method: 'github',
        is_new_user: true,
        user_id: 'test-user-id',
        email: 'test@example.com',
        share_id: 'share-1'
      })
      expectShareAuthConsumed()
    })
  })

  describe('accessBillingPortal', () => {
    it('should call billing endpoint without body when no targetTier provided', async () => {
      const result = await store.accessBillingPortal()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/billing'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-id-token',
            'Content-Type': 'application/json'
          })
        })
      )

      const callArgs = mockFetch.mock.calls.find((call) =>
        (call[0] as string).endsWith('/customers/billing')
      )
      expect(callArgs?.[1]).not.toHaveProperty('body')
      expect(result).toEqual({
        billing_portal_url: 'https://billing.stripe.com/test'
      })
    })

    it('should include target_tier in request body when targetTier provided', async () => {
      await store.accessBillingPortal('creator')

      const callArgs = mockFetch.mock.calls.find((call) =>
        (call[0] as string).endsWith('/customers/billing')
      )
      expect(callArgs?.[1]).toHaveProperty('body')
      expect(JSON.parse(callArgs?.[1]?.body as string)).toEqual({
        target_tier: 'creator'
      })
    })

    it('should handle different checkout tier formats', async () => {
      const tiers = [
        'standard',
        'creator',
        'pro',
        'standard-yearly',
        'creator-yearly',
        'pro-yearly'
      ] as const

      for (const tier of tiers) {
        mockFetch.mockClear()
        await store.accessBillingPortal(tier)

        const callArgs = mockFetch.mock.calls.find((call) =>
          (call[0] as string).endsWith('/customers/billing')
        )
        expect(JSON.parse(callArgs?.[1]?.body as string)).toEqual({
          target_tier: tier
        })
      }
    })

    it('should throw error when API returns error response', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Billing portal unavailable' })
        })
      )

      await expect(store.accessBillingPortal()).rejects.toThrow()
    })
  })

  describe('getAuthHeaderOrThrow', () => {
    it('returns auth header when authenticated', async () => {
      const header = await store.getAuthHeaderOrThrow()
      expect(header).toEqual({ Authorization: 'Bearer mock-id-token' })
    })

    it('throws AuthStoreError when not authenticated', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(store.getAuthHeaderOrThrow()).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
    })
  })

  describe('getFirebaseAuthHeaderOrThrow', () => {
    it('returns Firebase auth header when authenticated', async () => {
      const header = await store.getFirebaseAuthHeaderOrThrow()
      expect(header).toEqual({ Authorization: 'Bearer mock-id-token' })
    })

    it('throws AuthStoreError when not authenticated', async () => {
      authStateCallback(null)

      await expect(store.getFirebaseAuthHeaderOrThrow()).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
    })
  })

  describe('createCustomer', () => {
    it('sends signup_source on every call, even with no payload', async () => {
      await store.createCustomer()

      expect(customerRequestBody()).toEqual({ signup_source: 'cloud' })
    })

    it('preserves caller payload alongside signup_source', async () => {
      await store.createCustomer({ turnstile_token: 'token-xyz' })

      expect(customerRequestBody()).toEqual({
        turnstile_token: 'token-xyz',
        signup_source: 'cloud'
      })
    })

    it('should use API key auth when no Firebase user is present', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'test-api-key' })

      const result = await store.createCustomer()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-KEY': 'test-api-key'
          })
        })
      )
      expect(result).toEqual({ id: 'test-customer-id' })
    })

    it('should use Firebase token when Firebase user is present', async () => {
      const result = await store.createCustomer()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-id-token'
          })
        })
      )
      expect(result).toEqual({ id: 'test-customer-id' })
    })

    it('should not fall back to API key when Firebase token retrieval fails', async () => {
      mockUser.getIdToken.mockResolvedValue(undefined)
      mockApiKeyGetAuthHeader.mockReturnValue({ 'X-API-KEY': 'test-api-key' })

      await expect(store.createCustomer()).rejects.toThrow()
      expect(mockApiKeyGetAuthHeader).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should throw when no auth method is available', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(store.createCustomer()).rejects.toThrow()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('carries the HTTP status on a non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity'
      })

      const error = await store.createCustomer().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(AuthStoreError)
      expect((error as AuthStoreError).status).toBe(422)
    })
  })

  describe('fetchWithCustomerRecovery', () => {
    function make409(message: string) {
      const body = { message }
      return {
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve(body),
        clone: () => ({ json: () => Promise.resolve(body) })
      }
    }
    function makeConflictResponse() {
      return make409('Failed to find customer')
    }

    function countCustomerPosts() {
      return mockFetch.mock.calls.filter(
        ([url, init]) =>
          typeof url === 'string' &&
          url.endsWith('/customers') &&
          (init as RequestInit | undefined)?.method === 'POST'
      ).length
    }

    it('should provision the customer and retry once when a /customers/* call returns 409', async () => {
      let balanceCalls = 0
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        if (url.endsWith('/customers/balance')) {
          balanceCalls++
          return Promise.resolve(
            balanceCalls === 1
              ? makeConflictResponse()
              : mockFetchBalanceResponse
          )
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      const result = await store.fetchBalance()

      expect(result).toEqual({ balance: 0 })
      expect(balanceCalls).toBe(2)
      expect(countCustomerPosts()).toBe(1)
    })

    it('should deduplicate concurrent recovery attempts into a single customer creation', async () => {
      const seenUrls = new Set<string>()
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          return Promise.resolve(makeConflictResponse())
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      const [first, second] = await Promise.all([
        store.fetchWithCustomerRecovery('https://api.test/customers/balance'),
        store.fetchWithCustomerRecovery(
          'https://api.test/customers/cloud-subscription-status'
        )
      ])

      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      expect(countCustomerPosts()).toBe(1)
    })

    it('should not provision the customer again after a successful recovery', async () => {
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        // Endpoint keeps conflicting even after recovery succeeds
        return Promise.resolve(makeConflictResponse())
      })

      const first = await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )
      const second = await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )

      expect(first.status).toBe(409)
      expect(second.status).toBe(409)
      expect(countCustomerPosts()).toBe(1)
    })

    it('should return the original 409 response when customer provisioning fails', async () => {
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
          })
        }
        return Promise.resolve(makeConflictResponse())
      })

      const response = await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )

      expect(response.status).toBe(409)
      expect(countCustomerPosts()).toBe(1)
    })

    it('should pass through non-409 responses without provisioning', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      )

      const response = await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )

      expect(response.ok).toBe(true)
      expect(countCustomerPosts()).toBe(0)
    })

    it('should not provision for a 409 that is not a missing-customer conflict', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(make409('Subscription already active'))
      )

      const response = await store.fetchWithCustomerRecovery(
        'https://api.test/customers/cloud-subscription-checkout/standard',
        { method: 'POST' }
      )

      expect(response.status).toBe(409)
      expect(countCustomerPosts()).toBe(0)
    })

    it('should not provision for a 409 from a non-customer endpoint', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(makeConflictResponse())
      )

      const response = await store.fetchWithCustomerRecovery(
        'https://api.test/workflows'
      )

      expect(response.status).toBe(409)
      expect(countCustomerPosts()).toBe(0)
    })

    it('should not provision when /customers/ is not the root path segment', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(makeConflictResponse())
      )

      const response = await store.fetchWithCustomerRecovery(
        'https://api.test/foo/customers/bar'
      )

      expect(response.status).toBe(409)
      expect(countCustomerPosts()).toBe(0)
    })

    it('should re-provision after the auth state changes to a different session', async () => {
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        return Promise.resolve(makeConflictResponse())
      })

      await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )
      expect(countCustomerPosts()).toBe(1)

      // Sign out, then a different account signs in: the memoized recovery
      // from the previous account must not short-circuit the new one.
      authStateCallback(null)
      authStateCallback(mockUser)

      await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )
      expect(countCustomerPosts()).toBe(2)
    })

    it('re-provisions when the active uid changes without an auth-state reset', async () => {
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        return Promise.resolve(makeConflictResponse())
      })

      await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )
      expect(countCustomerPosts()).toBe(1)

      // A uid change that did not pass through onAuthStateChanged (which would
      // otherwise clear the memo) must still start a fresh recovery rather than
      // reuse the previous account's settled one.
      store.currentUser = {
        ...mockUser,
        uid: 'different-uid'
      } as Partial<User> as User

      await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )
      expect(countCustomerPosts()).toBe(2)
    })

    it('should return the original 409 when the retry fails at the network level', async () => {
      let balanceCalls = 0
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        balanceCalls++
        return balanceCalls === 1
          ? Promise.resolve(makeConflictResponse())
          : Promise.reject(new TypeError('network down'))
      })

      const response = await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )

      expect(response.status).toBe(409)
      expect(countCustomerPosts()).toBe(1)
    })

    it('should share one customer creation between concurrent credit pre-flights', async () => {
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        if (url.endsWith('/customers/credit')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ checkout_url: 'https://stripe.test/checkout' })
          })
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      await Promise.all([
        store.initiateCreditPurchase({
          amount_micros: 5_000_000,
          currency: 'usd'
        }),
        store.initiateCreditPurchase({
          amount_micros: 5_000_000,
          currency: 'usd'
        })
      ])

      expect(countCustomerPosts()).toBe(1)
    })

    it('stale rejection from previous session does not null out a new in-flight recovery', async () => {
      let rejectSession1Create!: (reason: unknown) => void
      let resolveSession2Create!: (value: Response) => void
      let postCount = 0

      const session1CreateP = new Promise<Response>((_, reject) => {
        rejectSession1Create = reject
      })
      const session2CreateP = new Promise<Response>((resolve) => {
        resolveSession2Create = resolve
      })

      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          postCount++
          return postCount === 1 ? session1CreateP : session2CreateP
        }
        return Promise.resolve(makeConflictResponse())
      })

      // Session 1: trigger a recovery whose POST will hang
      const session1Done = store
        .fetchWithCustomerRecovery('https://api.test/customers/balance')
        .then(() => 'session1')
        .catch(() => 'session1-failed')

      // Drain microtasks so session1's POST is registered
      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      // Auth resets; new session starts
      authStateCallback(null)
      authStateCallback(mockUser)

      // Session 2 recovery — should create a new independent in-flight promise
      const session2Done = store
        .fetchWithCustomerRecovery('https://api.test/customers/balance')
        .then(() => 'session2')
        .catch(() => 'session2-failed')

      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      // Session 1's POST fails — stale rejection fires; must NOT null out session 2's recovery
      rejectSession1Create(new Error('network error'))
      await session1Done

      // Session 2's POST resolves successfully
      resolveSession2Create({
        ok: true,
        statusText: 'OK',
        json: () => Promise.resolve({ id: 'id-2' })
      } as Response)
      const session2Result = await session2Done

      // Session 2 must succeed, proving its recovery was not nulled by session 1's rejection
      expect(session2Result).toBe('session2')
    })

    it('does not skip re-provisioning when createCustomer resolves after sign-out', async () => {
      let resolveCreate!: (value: Response) => void
      const slowCreateP = new Promise<Response>((resolve) => {
        resolveCreate = resolve
      })
      let postCount = 0

      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/customers') && init?.method === 'POST') {
          postCount++
          return postCount === 1
            ? slowCreateP
            : Promise.resolve(mockCreateCustomerResponse)
        }
        return Promise.resolve(makeConflictResponse())
      })

      // Session 1 triggers recovery with a slow POST
      const session1Done = store
        .fetchWithCustomerRecovery('https://api.test/customers/balance')
        .catch(() => {})

      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      // User signs out before the POST resolves
      authStateCallback(null)
      authStateCallback(mockUser)

      // Stale POST resolves successfully after session reset
      resolveCreate!({
        ok: true,
        statusText: 'OK',
        json: () => Promise.resolve({ id: 'stale-id' })
      } as Response)
      await session1Done

      // A fresh recovery for the new session must POST again;
      // customerCreated must not have been set by the stale resolution.
      await store.fetchWithCustomerRecovery(
        'https://api.test/customers/balance'
      )
      expect(postCount).toBe(2)
    })
  })

  describe('realtime socket identity lifecycle', () => {
    const accountB: MockUser = {
      ...mockUser,
      uid: 'account-b-id',
      email: 'b@example.com'
    } as MockUser

    it('does not reset the socket on the initial sign-in', () => {
      // The store is created in beforeEach, which drives the initial
      // authStateCallback(mockUser); the first identity must not reconnect
      // because api.init() already owns the initial connect.
      expect(mockResetSocket).not.toHaveBeenCalled()
    })

    it('reconnects the socket on a direct A -> B account switch', () => {
      mockResetSocket.mockClear()

      authStateCallback(accountB)

      expect(mockResetSocket).toHaveBeenCalledTimes(1)
    })

    it('discards a remote config response from the previous account', async () => {
      let resolveAccountA: ((response: Response) => void) | undefined
      let accountASignal: AbortSignal | undefined
      vi.spyOn(api, 'fetchApi')
        .mockImplementationOnce(
          (_route, options) =>
            new Promise<Response>((resolve) => {
              accountASignal = options?.signal ?? undefined
              resolveAccountA = resolve
            })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ legacy_billing_migration_enabled: false }),
            { status: 200 }
          )
        )

      const accountARefresh = refreshRemoteConfig()
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(1))

      authStateCallback(accountB)
      expect(accountASignal?.aborted).toBe(true)
      expect(remoteConfigState.value).toBe('unloaded')
      expect(cachedLegacyBillingMigrationEnabled.value).toBeUndefined()

      await refreshRemoteConfig()
      resolveAccountA?.(
        new Response(
          JSON.stringify({ legacy_billing_migration_enabled: true }),
          { status: 200 }
        )
      )
      await accountARefresh

      expect(remoteConfig.value.legacy_billing_migration_enabled).toBe(false)
      expect(cachedLegacyBillingMigrationEnabled.value).toBe(false)
    })

    it('does not reconnect on a same-account token refresh', () => {
      mockResetSocket.mockClear()

      // Same UID observed again (e.g. onAuthStateChanged re-emitting the same
      // user) must not tear down the connection.
      authStateCallback(mockUser)

      expect(mockResetSocket).not.toHaveBeenCalled()
    })

    it('reconnects the socket on sign-out', () => {
      mockResetSocket.mockClear()

      authStateCallback(null)

      expect(mockResetSocket).toHaveBeenCalledTimes(1)
    })

    it('does not reconnect when transitioning from signed-out to signed-in', () => {
      authStateCallback(null)
      mockResetSocket.mockClear()

      // Re-signing in from a signed-out state records the identity again; the
      // socket was already torn down on sign-out, so there is no extra reset.
      authStateCallback(accountB)

      expect(mockResetSocket).not.toHaveBeenCalled()
    })
  })
})
