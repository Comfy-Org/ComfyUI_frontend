import * as firebaseAuth from 'firebase/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vuefire from 'vuefire'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

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
  statusText: 'OK'
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

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn()
  },
  GithubAuthProvider: class {
    setCustomParameters = vi.fn()
  },
  browserLocalPersistence: 'browserLocalPersistence',
  setPersistence: vi.fn().mockResolvedValue(undefined)
}))

// Mock useToastStore
vi.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    add: vi.fn()
  })
}))

// Mock useDialogService
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showSettingsDialog: vi.fn()
  })
}))

describe('useFirebaseAuthStore', () => {
  let store: ReturnType<typeof useFirebaseAuthStore>
  let authStateCallback: (user: any) => void

  const mockAuth = {
    /* mock Auth object */
  }

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    getIdToken: vi.fn().mockResolvedValue('mock-id-token')
  }

  beforeEach(() => {
    vi.resetAllMocks()

    // Mock useFirebaseAuth to return our mock auth object
    vi.mocked(vuefire.useFirebaseAuth).mockReturnValue(mockAuth as any)

    // Mock onAuthStateChanged to capture the callback and simulate initial auth state
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      (_, callback) => {
        authStateCallback = callback as (user: any) => void
        // Call the callback with our mock user
        ;(callback as (user: any) => void)(mockUser)
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
      if (url.endsWith('/customers/billing-portal')) {
        return Promise.resolve(mockAccessBillingPortalResponse)
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    // Initialize Pinia
    setActivePinia(createPinia())
    store = useFirebaseAuthStore()

    // Reset and set up getIdToken mock
    mockUser.getIdToken.mockReset()
    mockUser.getIdToken.mockResolvedValue('mock-id-token')
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
    } as any)

    await store.login('test@example.com', 'correct-password')
  })

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const mockUserCredential = { user: mockUser }
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential as any
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
        mockUserCredential as any
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
        mockUserCredential as any
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

      expect(token).toBeNull()
    })

    it('should return null for token after login and logout sequence', async () => {
      // Setup mock for login
      const mockUserCredential = { user: mockUser }
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockUserCredential as any
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
      expect(tokenAfterLogout).toBeNull()
    })
  })

  describe('social authentication', () => {
    describe('loginWithGoogle', () => {
      it('should sign in with Google', async () => {
        const mockUserCredential = { user: mockUser }
        vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
          mockUserCredential as any
        )

        const result = await store.loginWithGoogle()

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalledWith(
          mockAuth,
          expect.any(firebaseAuth.GoogleAuthProvider)
        )
        expect(result).toEqual(mockUserCredential)
        expect(store.loading).toBe(false)
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
          mockUserCredential as any
        )

        const result = await store.loginWithGithub()

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalledWith(
          mockAuth,
          expect.any(firebaseAuth.GithubAuthProvider)
        )
        expect(result).toEqual(mockUserCredential)
        expect(store.loading).toBe(false)
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
        mockUserCredential as any
      )

      const googleLoginPromise = store.loginWithGoogle()
      const githubLoginPromise = store.loginWithGithub()

      await Promise.all([googleLoginPromise, githubLoginPromise])

      expect(store.loading).toBe(false)
    })
  })
})
