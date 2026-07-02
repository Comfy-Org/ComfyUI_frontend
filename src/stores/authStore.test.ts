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
import { useDialogService } from '@/services/dialogService'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { createTestingPinia } from '@pinia/testing'

// Hoisted mocks for dynamic imports
const { mockDistributionTypes } = vi.hoisted(() => ({
  mockDistributionTypes: {
    isCloud: true,
    isDesktop: true
  }
}))

const { mockFeatureFlags } = vi.hoisted(() => ({
  mockFeatureFlags: {
    teamWorkspacesEnabled: false,
    unifiedCloudAuthEnabled: false
  }
}))

type MockUser = Omit<User, 'getIdToken' | 'delete'> & {
  getIdToken: Mock
  delete: Mock
}

type MockAuth = Record<string, unknown>

/**
 * Centralizes the type-boundary double-cast for Firebase mock credentials
 * so individual tests only deal with the mock user.
 */
function asUserCredential(user: Partial<MockUser>): UserCredential {
  return { user } as Partial<UserCredential> as UserCredential
}

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

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
    sendPasswordResetEmail: vi.fn(),
    GoogleAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    },
    GithubAuthProvider: class {
      addScope = vi.fn()
      setCustomParameters = vi.fn()
    },
    getAdditionalUserInfo: vi.fn(),
    setPersistence: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn()
  }
})

// Mock telemetry
const mockTrackAuth = vi.fn()
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackAuth: mockTrackAuth
  })
}))

// Mock useToastStore
vi.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    add: vi.fn()
  })
}))

// Mock useDialogService
vi.mock('@/services/dialogService')
vi.mock('@/platform/distribution/types', () => mockDistributionTypes)
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFeatureFlags
  })
}))

const mockWorkspaceAuthStore = vi.hoisted(() => ({
  unifiedToken: null as string | null,
  clearWorkspaceContext: vi.fn(),
  mintAtLogin: vi.fn(),
  getWorkspaceAuthHeader: vi.fn(),
  getWorkspaceToken: vi.fn()
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => mockWorkspaceAuthStore
}))

// Mock apiKeyAuthStore
const mockApiKeyGetAuthHeader = vi.fn().mockReturnValue(null)
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({
    getAuthHeader: mockApiKeyGetAuthHeader,
    getApiKey: vi.fn(),
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

  const mockAuth: MockAuth = {
    /* mock Auth object */
  }

  const mockUser: MockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    delete: vi.fn().mockResolvedValue(undefined)
  } as Partial<User> as MockUser

  beforeEach(() => {
    vi.resetAllMocks()
    sessionStorage.clear()
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.SHARE_AUTH)

    mockFeatureFlags.teamWorkspacesEnabled = false
    mockFeatureFlags.unifiedCloudAuthEnabled = false
    mockWorkspaceAuthStore.unifiedToken = null
    mockWorkspaceAuthStore.getWorkspaceAuthHeader.mockReturnValue(null)
    mockWorkspaceAuthStore.getWorkspaceToken.mockReturnValue(undefined)

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

    // Initialize Pinia
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useAuthStore()

    // Reset and set up getIdToken mock
    mockUser.getIdToken.mockReset()
    mockUser.getIdToken.mockResolvedValue('mock-id-token')

    // Default: no API key auth
    mockApiKeyGetAuthHeader.mockReturnValue(null)
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

    it('ignores null ID token events', () => {
      idTokenCallback?.(null)
      expect(store.tokenRefreshTrigger).toBe(0)
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

  it('mints workspace auth on cloud login and clears it on logout state', () => {
    expect(mockWorkspaceAuthStore.mintAtLogin).toHaveBeenCalledOnce()

    authStateCallback(null)

    expect(mockWorkspaceAuthStore.clearWorkspaceContext).toHaveBeenCalledOnce()
  })

  it('does not mint workspace auth outside cloud', () => {
    mockWorkspaceAuthStore.mintAtLogin.mockClear()
    mockDistributionTypes.isCloud = false

    try {
      authStateCallback(mockUser)

      expect(mockWorkspaceAuthStore.mintAtLogin).not.toHaveBeenCalled()
    } finally {
      mockDistributionTypes.isCloud = true
    }
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
    vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValueOnce(
      asUserCredential(mockUser)
    )

    await store.login('test@example.com', 'correct-password')
  })

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const mockUserCredential = asUserCredential(mockUser)
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential
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

    it('tracks login when Firebase returns no email', async () => {
      const userWithoutEmail = { ...mockUser, email: null }
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        asUserCredential(userWithoutEmail)
      )

      await store.login('test@example.com', 'password')

      expect(mockTrackAuth).toHaveBeenCalledWith(
        expect.objectContaining({ email: undefined })
      )
    })

    it('fails customer creation when the signed-in user has no token yet', async () => {
      authStateCallback(null)
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        asUserCredential(mockUser)
      )

      await expect(store.login('test@example.com', 'password')).rejects.toThrow(
        'Cannot create customer: User not authenticated'
      )
    })

    it('should handle concurrent login attempts correctly', async () => {
      // Set up multiple login promises
      const mockUserCredential = asUserCredential(mockUser)
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential
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
      const mockUserCredential = asUserCredential(mockUser)
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        mockUserCredential
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
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        asUserCredential(mockUser)
      )

      await store.register('new@example.com', 'password', 'turnstile-abc')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ turnstile_token: 'turnstile-abc' })
        })
      )
    })

    it('omits the request body when no turnstile token is provided', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        asUserCredential(mockUser)
      )

      await store.register('new@example.com', 'password')

      const customerCall = mockFetch.mock.calls.find(([url]) =>
        String(url).endsWith('/customers')
      )
      expect(customerCall?.[1]).not.toHaveProperty('body')
    })

    it('rolls back the orphaned Firebase user when customer creation fails', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        asUserCredential(mockUser)
      )
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
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        asUserCredential(mockUser)
      )

      await store.register('new@example.com', 'password')

      expect(mockUser.delete).not.toHaveBeenCalled()
    })

    it('does not delete an existing user when customer creation fails during login', async () => {
      // Regression guard: the rollback must be scoped to register only — login
      // signs in an EXISTING user, so a customer hiccup must never delete it.
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        asUserCredential(mockUser)
      )
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

    it('tracks registration when Firebase returns no email', async () => {
      const userWithoutEmail = { ...mockUser, email: null }
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        asUserCredential(userWithoutEmail)
      )

      await store.register('new@example.com', 'password')

      expect(mockTrackAuth).toHaveBeenCalledWith(
        expect.objectContaining({ email: undefined })
      )
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

    it('should return null for token after login and logout sequence', async () => {
      // Setup mock for login
      const mockUserCredential = asUserCredential(mockUser)
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential
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

    it('uses the unified cloud token when enabled', async () => {
      mockFeatureFlags.unifiedCloudAuthEnabled = true
      mockWorkspaceAuthStore.unifiedToken = 'unified-token'

      await expect(store.getAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer unified-token'
      })
      await expect(store.getAuthToken()).resolves.toBe('unified-token')
    })

    it('returns no unified auth when the unified token is missing', async () => {
      mockFeatureFlags.unifiedCloudAuthEnabled = true
      mockWorkspaceAuthStore.unifiedToken = null

      await expect(store.getAuthHeader()).resolves.toBeNull()
      await expect(store.getAuthToken()).resolves.toBeUndefined()
    })

    it('prefers workspace auth when team workspaces are enabled', async () => {
      mockFeatureFlags.teamWorkspacesEnabled = true
      mockWorkspaceAuthStore.getWorkspaceAuthHeader.mockReturnValue({
        Authorization: 'Bearer workspace-header'
      })
      mockWorkspaceAuthStore.getWorkspaceToken.mockReturnValue(
        'workspace-token'
      )

      await expect(store.getAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer workspace-header'
      })
      await expect(store.getAuthToken()).resolves.toBe('workspace-token')
    })

    it('falls back to Firebase when workspace auth is unavailable', async () => {
      mockFeatureFlags.teamWorkspacesEnabled = true
      mockWorkspaceAuthStore.getWorkspaceAuthHeader.mockReturnValue(null)
      mockWorkspaceAuthStore.getWorkspaceToken.mockReturnValue(undefined)

      await expect(store.getAuthHeader()).resolves.toEqual({
        Authorization: 'Bearer mock-id-token'
      })
      await expect(store.getAuthToken()).resolves.toBe('mock-id-token')
    })

    it('returns the Firebase token by default', async () => {
      await expect(store.getAuthToken()).resolves.toBe('mock-id-token')
    })
  })

  describe('social authentication', () => {
    describe('loginWithGoogle', () => {
      it('should sign in with Google', async () => {
        const mockUserCredential = asUserCredential(mockUser)
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          mockUserCredential
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
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          asUserCredential(mockUser)
        )

        await store.loginWithGoogle()

        const customerCall = mockFetch.mock.calls.find(([url]) =>
          String(url).endsWith('/customers')
        )
        expect(customerCall).toBeDefined()
        expect(customerCall?.[1]).not.toHaveProperty('body')
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
        const mockUserCredential = asUserCredential(mockUser)
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          mockUserCredential
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
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          asUserCredential(mockUser)
        )

        await store.loginWithGithub()

        const customerCall = mockFetch.mock.calls.find(([url]) =>
          String(url).endsWith('/customers')
        )
        expect(customerCall).toBeDefined()
        expect(customerCall?.[1]).not.toHaveProperty('body')
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
      const mockUserCredential = asUserCredential(mockUser)
      vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
        mockUserCredential
      )

      const googleLoginPromise = store.loginWithGoogle()
      const githubLoginPromise = store.loginWithGithub()

      await Promise.all([googleLoginPromise, githubLoginPromise])

      expect(store.loading).toBe(false)
    })

    describe('sign-up telemetry OR logic', () => {
      const mockUserCredential = asUserCredential(mockUser)

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

      it.for(['loginWithGoogle', 'loginWithGithub'] as const)(
        '%s should track undefined email when Firebase returns no email',
        async (method) => {
          const userWithoutEmail = { ...mockUser, email: null }
          vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
            asUserCredential(userWithoutEmail)
          )

          await store[method]()

          expect(mockTrackAuth).toHaveBeenCalledWith(
            expect.objectContaining({ email: undefined })
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

    it('throws when no auth method is available', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(store.accessBillingPortal()).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
    })
  })

  describe('fetchBalance', () => {
    it('stores the balance and update time when fetching succeeds', async () => {
      await expect(store.fetchBalance()).resolves.toEqual({ balance: 0 })

      expect(store.balance).toEqual({ balance: 0 })
      expect(store.lastBalanceUpdateTime).toBeInstanceOf(Date)
      expect(store.isFetchingBalance).toBe(false)
    })

    it('throws when no auth method is available', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(store.fetchBalance()).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
      expect(store.isFetchingBalance).toBe(false)
    })

    it('returns null when the customer balance is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      await expect(store.fetchBalance()).resolves.toBeNull()
      expect(store.balance).toBeNull()
      expect(store.isFetchingBalance).toBe(false)
    })

    it('throws API errors when fetching balance fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Balance unavailable' })
      })

      await expect(store.fetchBalance()).rejects.toThrow(
        'toastMessages.failedToFetchBalance'
      )
      expect(store.isFetchingBalance).toBe(false)
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
    it('should succeed with API key auth when no Firebase user is present', async () => {
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

    it('should throw when no auth method is available', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(store.createCustomer()).rejects.toThrow()
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

    it('throws when the response has no customer id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      await expect(store.createCustomer()).rejects.toThrow(
        'toastMessages.failedToCreateCustomer'
      )
    })
  })

  describe('password actions', () => {
    it('sends password reset emails', async () => {
      vi.mocked(firebaseAuth.sendPasswordResetEmail).mockResolvedValue()

      await store.sendPasswordReset('test@example.com')

      expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com'
      )
    })

    it('updates the current user password', async () => {
      vi.mocked(firebaseAuth.updatePassword).mockResolvedValue()

      await store.updatePassword('new-password')

      expect(firebaseAuth.updatePassword).toHaveBeenCalledWith(
        mockUser,
        'new-password'
      )
    })

    it('throws when updating password without a user', async () => {
      authStateCallback(null)

      await expect(store.updatePassword('new-password')).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
    })
  })

  describe('initiateCreditPurchase', () => {
    it('creates the customer once before adding credits', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('/customers')) {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        if (url.endsWith('/customers/credit')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ redirect_url: 'https://stripe.test' })
          })
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      await store.initiateCreditPurchase({
        amount_micros: 10_000_000,
        currency: 'usd'
      })
      await store.initiateCreditPurchase({
        amount_micros: 10_000_000,
        currency: 'usd'
      })

      const customerCalls = mockFetch.mock.calls.filter(([url]) =>
        String(url).endsWith('/customers')
      )
      expect(customerCalls).toHaveLength(1)
    })

    it('throws when credit purchase fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('/customers')) {
          return Promise.resolve(mockCreateCustomerResponse)
        }
        if (url.endsWith('/customers/credit')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: 'Checkout unavailable' })
          })
        }
        return Promise.reject(new Error('Unexpected API call'))
      })

      await expect(
        store.initiateCreditPurchase({
          amount_micros: 10_000_000,
          currency: 'usd'
        })
      ).rejects.toThrow('toastMessages.failedToInitiateCreditPurchase')
    })

    it('throws when no auth method is available', async () => {
      authStateCallback(null)
      mockApiKeyGetAuthHeader.mockReturnValue(null)

      await expect(
        store.initiateCreditPurchase({
          amount_micros: 10_000_000,
          currency: 'usd'
        })
      ).rejects.toMatchObject({
        name: 'AuthStoreError',
        message: 'toastMessages.userNotAuthenticated'
      })
    })
  })
})
