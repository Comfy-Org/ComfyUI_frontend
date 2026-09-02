import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from './useCurrentUser'

const mockAuthState = {
  currentUser: null as { uid: string } | null,
  loading: false,
  tokenRefreshTrigger: 0
}
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState
}))

const mockApiKeyState = {
  isAuthenticated: false,
  currentUser: null as { id: string; email?: string; name?: string } | null
}
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => mockApiKeyState
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

describe('useCurrentUser', () => {
  beforeEach(() => {
    mockAuthState.currentUser = null
    mockApiKeyState.isAuthenticated = false
    mockApiKeyState.currentUser = null
  })

  it('treats a key-only session as an API-key login', () => {
    mockApiKeyState.isAuthenticated = true
    mockApiKeyState.currentUser = { id: 'key-user' }

    const { isApiKeyLogin, isLoggedIn, resolvedUserInfo } = useCurrentUser()

    expect(isApiKeyLogin.value).toBe(true)
    expect(isLoggedIn.value).toBe(true)
    expect(resolvedUserInfo.value).toEqual({ id: 'key-user' })
  })

  it('gives the Firebase session precedence over a stored API key', () => {
    mockAuthState.currentUser = { uid: 'firebase-user' }
    mockApiKeyState.isAuthenticated = true
    mockApiKeyState.currentUser = { id: 'key-user' }

    const { isApiKeyLogin, isLoggedIn, resolvedUserInfo } = useCurrentUser()

    expect(isApiKeyLogin.value).toBe(false)
    expect(isLoggedIn.value).toBe(true)
    expect(resolvedUserInfo.value).toEqual({ id: 'firebase-user' })
  })
})
