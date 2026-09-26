import { fromPartial } from '@total-typescript/shoehorn'
import { useAuthStore } from '@/stores/authStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useCommandStore } from '@/stores/commandStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as storageIO from '@/platform/workflow/persistence/base/storageIO'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import { useCurrentUser } from './useCurrentUser'

vi.mock(import('firebase/auth'))

const distributionMocks = vi.hoisted(() => ({ isCloud: false }))

// Full mock rather than a spread of the original: `isCloud` is a build-time
// constant, so there is nothing to spy on, and the module's whole surface is
// four derived booleans.
vi.mock(import('@/platform/distribution/types'), () => ({
  get DISTRIBUTION() {
    return distributionMocks.isCloud ? 'cloud' : 'localhost'
  },
  get isCloud() {
    return distributionMocks.isCloud
  },
  isDesktop: false,
  isNightly: false
}))

let mockAuthState: ReturnType<typeof useAuthStore>

let mockApiKeyState: ReturnType<typeof useApiKeyAuthStore>

describe('useCurrentUser', () => {
  beforeEach(() => {
    mockAuthState = useAuthStore()
    mockApiKeyState = useApiKeyAuthStore()
    mockAuthState.currentUser = null
    Object.assign(mockApiKeyState, { isAuthenticated: false })
    mockApiKeyState.currentUser = null
    distributionMocks.isCloud = false
    vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
  })

  afterEach(() => {
    // `workflowStorageState` is module-level, so a test that fences it has to
    // release it or every later test reads an unavailable store.
    storageIO.resetStorageAvailable()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('treats a key-only session as an API-key login', () => {
    Object.assign(mockApiKeyState, { isAuthenticated: true })
    mockApiKeyState.currentUser = fromPartial<
      NonNullable<typeof mockApiKeyState.currentUser>
    >({ id: 'key-user' })

    const { isApiKeyLogin, isLoggedIn, resolvedUserInfo } = useCurrentUser()

    expect(isApiKeyLogin.value).toBe(true)
    expect(isLoggedIn.value).toBe(true)
    expect(resolvedUserInfo.value).toEqual({ id: 'key-user' })
  })

  it('gives the Firebase session precedence over a stored API key', () => {
    mockAuthState.currentUser = fromPartial<
      NonNullable<typeof mockAuthState.currentUser>
    >({ uid: 'firebase-user' })
    Object.assign(mockApiKeyState, { isAuthenticated: true })
    mockApiKeyState.currentUser = fromPartial<
      NonNullable<typeof mockApiKeyState.currentUser>
    >({ id: 'key-user' })

    const { isApiKeyLogin, isLoggedIn, resolvedUserInfo } = useCurrentUser()

    expect(isApiKeyLogin.value).toBe(false)
    expect(isLoggedIn.value).toBe(true)
    expect(resolvedUserInfo.value).toEqual({ id: 'firebase-user' })
  })

  describe('handleSignOut', () => {
    function signInWithApiKeyOnly(): void {
      Object.assign(mockApiKeyState, { isAuthenticated: true })
      mockApiKeyState.currentUser = fromPartial<
        NonNullable<typeof mockApiKeyState.currentUser>
      >({ id: 'key-user' })
    }

    const draftIndexKey = StorageKeys.draftIndex('personal')

    it('runs the cloud logout cleanup on the key-only rail, which never reaches the sign-out command', async () => {
      distributionMocks.isCloud = true
      signInWithApiKeyOnly()
      localStorage.setItem(draftIndexKey, '{}')

      const { handleSignOut, isApiKeyLogin } = useCurrentUser()
      expect(isApiKeyLogin.value).toBe(true)

      await handleSignOut()

      // `Comfy.User.SignOut` is the only other caller of the fence-and-clear
      // pair, and this rail does not execute it.
      expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalledWith(
        'Comfy.User.SignOut'
      )
      expect(localStorage.getItem(draftIndexKey)).toBeNull()
      expect(storageIO.isStorageAvailable()).toBe(false)
    })

    it('leaves workflow storage alone on the key-only rail outside cloud', async () => {
      distributionMocks.isCloud = false
      signInWithApiKeyOnly()
      localStorage.setItem(draftIndexKey, '{}')

      const { handleSignOut } = useCurrentUser()
      await handleSignOut()

      expect(localStorage.getItem(draftIndexKey)).toBe('{}')
      expect(storageIO.isStorageAvailable()).toBe(true)
    })

    it('delegates a Firebase session to the sign-out command rather than cleaning up twice', async () => {
      distributionMocks.isCloud = true
      mockAuthState.currentUser = fromPartial<
        NonNullable<typeof mockAuthState.currentUser>
      >({ uid: 'firebase-user' })
      localStorage.setItem(draftIndexKey, '{}')

      const { handleSignOut } = useCurrentUser()
      await handleSignOut()

      expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
        'Comfy.User.SignOut'
      )
      // The command owns the cleanup on this rail; doing it here as well would
      // fence the store a second time behind a release that already fired.
      expect(localStorage.getItem(draftIndexKey)).toBe('{}')
      expect(storageIO.isStorageAvailable()).toBe(true)
    })
  })
})
