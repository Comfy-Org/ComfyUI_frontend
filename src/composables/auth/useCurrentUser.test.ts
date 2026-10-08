import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { fakeWebSessionUser } from '@comfyorg/account-core/testing'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAuthStore } from '@/stores/authStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useCommandStore } from '@/stores/commandStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import * as storageIO from '@/platform/workflow/persistence/base/storageIO'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import { useCurrentUser } from './useCurrentUser'

vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/useFeatureFlags'))

const distributionMocks = vi.hoisted(() => ({ isCloud: false }))

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
    storageIO.resetStorageAvailable()
  })

  afterEach(() => stopDesktopHostSession())

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

  it('gives the Desktop host account precedence over a stored API key', async () => {
    await startDesktopHostSession({
      getState: async () => ({ status: 'signed_in', userId: 'host-user' }),
      getWorkspaceToken: async () => 'host-token',
      requestSignIn: async () => ({ status: 'signed_in', userId: 'host-user' }),
      signOut: async () => ({ status: 'signed_out' }),
      onChanged: () => () => {}
    })
    Object.assign(mockApiKeyState, { isAuthenticated: true })
    mockApiKeyState.currentUser = fromPartial<
      NonNullable<typeof mockApiKeyState.currentUser>
    >({ id: 'key-user' })

    const { isApiKeyLogin, isLoggedIn, resolvedUserInfo } = useCurrentUser()

    expect(isApiKeyLogin.value).toBe(false)
    expect(isLoggedIn.value).toBe(true)
    expect(resolvedUserInfo.value).toEqual({ id: 'host-user' })
  })

  it('reads a Firebase-only login entirely from Firebase', () => {
    mockAuthState.currentUser = fromPartial<
      NonNullable<typeof mockAuthState.currentUser>
    >({
      uid: 'firebase-user',
      email: 'f@example.com',
      displayName: 'Firebase F',
      photoURL: 'https://example.com/f.png',
      providerData: [{ providerId: 'github.com' }]
    })

    const user = useCurrentUser()

    expect(user.isLoggedIn.value).toBe(true)
    expect(user.resolvedUserInfo.value).toEqual({ id: 'firebase-user' })
    expect(user.userEmail.value).toBe('f@example.com')
    expect(user.userDisplayName.value).toBe('Firebase F')
    expect(user.userPhotoUrl.value).toBe('https://example.com/f.png')
    expect(user.providerName.value).toBe('GitHub')
    expect(user.providerIcon.value).toBe('pi pi-github')
    expect(user.isEmailProvider.value).toBe(false)
  })

  it.for([
    {
      name: 'a session-only email login',
      firebase: null,
      sessionProvider: 'password',
      isEmailProvider: true,
      needsFirebaseSignIn: true
    },
    {
      name: 'a session-only Google login',
      firebase: null,
      sessionProvider: 'google.com',
      isEmailProvider: false,
      needsFirebaseSignIn: true
    },
    {
      name: 'a session beside a different Firebase user',
      firebase: { uid: 'other-user', providerId: 'password' },
      sessionProvider: 'password',
      isEmailProvider: true,
      needsFirebaseSignIn: true
    },
    {
      name: 'a session beside its own Firebase user',
      firebase: { uid: 'session-user', providerId: 'password' },
      sessionProvider: 'google.com',
      isEmailProvider: true,
      needsFirebaseSignIn: false
    }
  ])(
    'derives the Firebase-only account actions for $name',
    ({ firebase, sessionProvider, isEmailProvider, needsFirebaseSignIn }) => {
      mockAuthState.currentUser =
        firebase &&
        fromPartial<User>({
          uid: firebase.uid,
          providerData: [{ providerId: firebase.providerId }]
        })
      Object.assign(mockAuthState, {
        sessionUser: fakeWebSessionUser({
          id: 'session-user',
          signInProvider: sessionProvider
        })
      })

      const user = useCurrentUser()

      expect({
        isEmailProvider: user.isEmailProvider.value,
        needsFirebaseSignIn: user.needsFirebaseSignIn.value
      }).toEqual({ isEmailProvider, needsFirebaseSignIn })
    }
  )

  it.for([
    { name: 'an email Firebase login', providerId: 'password', email: true },
    { name: 'a GitHub Firebase login', providerId: 'github.com', email: false }
  ])(
    'never asks $name without a session to sign in again',
    ({ providerId, email }) => {
      mockAuthState.currentUser = fromPartial<User>({
        uid: 'firebase-user',
        providerData: [{ providerId }]
      })

      const { isEmailProvider, needsFirebaseSignIn } = useCurrentUser()

      expect(isEmailProvider.value).toBe(email)
      expect(needsFirebaseSignIn.value).toBe(false)
    }
  )

  it.for([
    { sso: true, provider: 'saml.workos', isEmailProvider: false },
    { sso: true, provider: 'oidc.workos', isEmailProvider: false },
    { sso: true, provider: 'google.com', isEmailProvider: true },
    { sso: false, provider: 'saml.workos', isEmailProvider: true }
  ])(
    'offers a password change beside a $provider session only when it is not SSO (sso_enabled $sso)',
    ({ sso, provider, isEmailProvider }) => {
      vi.mocked(useFeatureFlags().flags).ssoEnabled = sso
      mockAuthState.currentUser = fromPartial<User>({
        uid: 'session-user',
        providerData: [{ providerId: 'password' }]
      })
      Object.assign(mockAuthState, {
        sessionUser: fakeWebSessionUser({
          id: 'session-user',
          signInProvider: provider
        })
      })

      expect(useCurrentUser().isEmailProvider.value).toBe(isEmailProvider)
    }
  )

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
      expect(localStorage.getItem(draftIndexKey)).toBe('{}')
      expect(storageIO.isStorageAvailable()).toBe(true)
    })
  })
})
