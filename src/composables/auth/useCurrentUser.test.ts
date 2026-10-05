import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { fakeWebSessionUser } from '@comfyorg/account-core/testing'
import { useAuthStore } from '@/stores/authStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from './useCurrentUser'

vi.mock(import('firebase/auth'))

let mockAuthState: ReturnType<typeof useAuthStore>

let mockApiKeyState: ReturnType<typeof useApiKeyAuthStore>

describe('useCurrentUser', () => {
  beforeEach(() => {
    mockAuthState = useAuthStore()
    mockApiKeyState = useApiKeyAuthStore()
    mockAuthState.currentUser = null
    Object.assign(mockApiKeyState, { isAuthenticated: false })
    mockApiKeyState.currentUser = null
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
})
