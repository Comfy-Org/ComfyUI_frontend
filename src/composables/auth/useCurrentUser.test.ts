import { fromPartial } from '@total-typescript/shoehorn'
import { useAuthStore } from '@/stores/authStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeHostAuthBridge } from '@/platform/auth/host/__tests__/fakeHostAuthBridge'
import {
  startHostIdentity,
  stopHostIdentity
} from '@/platform/auth/host/hostIdentity'

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

  describe('with the Desktop host identity', () => {
    afterEach(() => stopHostIdentity())

    it('resolves the Comfy user id over Firebase and API-key sessions', async () => {
      mockAuthState.currentUser = fromPartial<
        NonNullable<typeof mockAuthState.currentUser>
      >({ uid: 'firebase-user' })
      Object.assign(mockApiKeyState, { isAuthenticated: true })
      await startHostIdentity(fakeHostAuthBridge().bridge)

      const {
        isHostLogin,
        isApiKeyLogin,
        isLoggedIn,
        resolvedUserInfo,
        userEmail
      } = useCurrentUser()

      expect(isHostLogin.value).toBe(true)
      expect(isApiKeyLogin.value).toBe(false)
      expect(isLoggedIn.value).toBe(true)
      expect(resolvedUserInfo.value).toEqual({ id: 'comfy-user-1' })
      expect(userEmail.value).toBe('ada@example.com')
    })

    it('logs out when the host signs out, ignoring a leftover Firebase user', async () => {
      mockAuthState.currentUser = fromPartial<
        NonNullable<typeof mockAuthState.currentUser>
      >({ uid: 'firebase-user' })
      const { bridge, push } = fakeHostAuthBridge()
      await startHostIdentity(bridge)
      const { isLoggedIn, resolvedUserInfo } = useCurrentUser()

      push({ status: 'signed_out' })

      expect(isLoggedIn.value).toBe(false)
      expect(resolvedUserInfo.value).toBeNull()
    })
  })
})
