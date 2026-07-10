import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { User as FirebaseUser } from 'firebase/auth'

import type { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'

type FirebaseUserMock = Pick<
  FirebaseUser,
  'uid' | 'displayName' | 'email' | 'photoURL'
> & {
  providerData: Array<Pick<FirebaseUser['providerData'][number], 'providerId'>>
}

type ApiKeyUser = NonNullable<
  ReturnType<typeof useApiKeyAuthStore>['currentUser']
>

const mockStores = vi.hoisted(() => ({
  authStore: undefined as
    | undefined
    | {
        currentUser: FirebaseUserMock | null
        loading: boolean
        tokenRefreshTrigger: number
      },
  apiKeyStore: undefined as
    | undefined
    | {
        isAuthenticated: boolean
        currentUser: ApiKeyUser | null
        clearStoredApiKey: ReturnType<typeof vi.fn>
      },
  commandStore: undefined as
    | undefined
    | {
        execute: ReturnType<typeof vi.fn>
      }
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockStores.authStore
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => mockStores.apiKeyStore
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => mockStores.commandStore
}))

async function setup() {
  vi.resetModules()
  const authStore = reactive({
    currentUser: null as FirebaseUserMock | null,
    loading: false,
    tokenRefreshTrigger: 0
  })
  const apiKeyStore = reactive({
    isAuthenticated: false,
    currentUser: null as ApiKeyUser | null,
    clearStoredApiKey: vi.fn()
  })
  const commandStore = {
    execute: vi.fn()
  }

  mockStores.authStore = authStore
  mockStores.apiKeyStore = apiKeyStore
  mockStores.commandStore = commandStore

  const { useCurrentUser } = await import('./useCurrentUser')
  return {
    currentUser: useCurrentUser(),
    authStore,
    apiKeyStore,
    commandStore
  }
}

function firebaseUser(
  providerId: string,
  overrides: Partial<FirebaseUserMock> = {}
): FirebaseUserMock {
  return {
    uid: 'firebase-user',
    displayName: 'Firebase User',
    email: 'firebase@example.com',
    photoURL: 'https://example.com/photo.png',
    providerData: [{ providerId }],
    ...overrides
  }
}

describe('useCurrentUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses API key user identity before firebase identity', async () => {
    const { currentUser, authStore, apiKeyStore } = await setup()
    expect(currentUser.isLoggedIn.value).toBe(false)

    authStore.currentUser = firebaseUser('google.com')
    apiKeyStore.isAuthenticated = true
    apiKeyStore.currentUser = {
      id: 'api-user',
      name: 'API User',
      email: 'api@example.com'
    }

    expect(currentUser.isLoggedIn.value).toBe(true)
    expect(currentUser.isApiKeyLogin.value).toBe(true)
    expect(currentUser.resolvedUserInfo.value).toEqual({ id: 'api-user' })
    expect(currentUser.userDisplayName.value).toBe('API User')
    expect(currentUser.userEmail.value).toBe('api@example.com')
    expect(currentUser.userPhotoUrl.value).toBeNull()
    expect(currentUser.providerName.value).toBe('Comfy API Key')
    expect(currentUser.providerIcon.value).toBe('pi pi-key')
    expect(currentUser.isEmailProvider.value).toBe(false)
  })

  it('maps firebase provider metadata to display fields', async () => {
    const { currentUser, authStore } = await setup()

    authStore.currentUser = firebaseUser('google.com')
    expect(currentUser.providerName.value).toBe('Google')
    expect(currentUser.providerIcon.value).toBe('pi pi-google')
    expect(currentUser.userDisplayName.value).toBe('Firebase User')
    expect(currentUser.userEmail.value).toBe('firebase@example.com')
    expect(currentUser.userPhotoUrl.value).toBe('https://example.com/photo.png')
    expect(currentUser.resolvedUserInfo.value).toEqual({ id: 'firebase-user' })

    authStore.currentUser = firebaseUser('github.com')
    expect(currentUser.providerName.value).toBe('GitHub')
    expect(currentUser.providerIcon.value).toBe('pi pi-github')

    authStore.currentUser = firebaseUser('password')
    expect(currentUser.providerName.value).toBe('password')
    expect(currentUser.providerIcon.value).toBe('pi pi-user')
    expect(currentUser.isEmailProvider.value).toBe(true)
  })

  it('routes sign out through the active auth source', async () => {
    const { currentUser, apiKeyStore, commandStore } = await setup()

    apiKeyStore.isAuthenticated = true
    apiKeyStore.currentUser = { id: 'api-user' }
    await currentUser.handleSignOut()
    expect(apiKeyStore.clearStoredApiKey).toHaveBeenCalledOnce()

    apiKeyStore.isAuthenticated = false
    await currentUser.handleSignOut()
    expect(commandStore.execute).toHaveBeenCalledWith('Comfy.User.SignOut')
  })

  it('runs user lifecycle callbacks for resolve, token refresh, and logout', async () => {
    const { currentUser, authStore } = await setup()
    const resolved = vi.fn()
    const tokenRefreshed = vi.fn()
    const logout = vi.fn()

    currentUser.onUserResolved(resolved)
    currentUser.onTokenRefreshed(tokenRefreshed)
    currentUser.onUserLogout(logout)

    authStore.currentUser = firebaseUser('google.com')
    await nextTick()
    expect(resolved.mock.calls[0][0]).toEqual({ id: 'firebase-user' })

    authStore.tokenRefreshTrigger += 1
    await nextTick()
    expect(tokenRefreshed).toHaveBeenCalledOnce()

    authStore.currentUser = null
    await nextTick()
    expect(logout).toHaveBeenCalledOnce()
  })

  it('runs onUserResolved immediately when a user already exists', async () => {
    const { currentUser, apiKeyStore } = await setup()
    apiKeyStore.isAuthenticated = true
    apiKeyStore.currentUser = { id: 'api-user' }
    const resolved = vi.fn()

    currentUser.onUserResolved(resolved)

    expect(resolved.mock.calls[0][0]).toEqual({ id: 'api-user' })
  })
})
