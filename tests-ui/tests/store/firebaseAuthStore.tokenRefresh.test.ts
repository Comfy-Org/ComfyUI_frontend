import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('vuefire', () => ({
  useFirebaseAuth: vi.fn()
}))

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>()
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

import * as firebaseAuth from 'firebase/auth'
import * as vuefire from 'vuefire'

type MinimalUser = { uid: string }

/** Create a minimal user-like object with a stable uid */
function makeUser(uid: string): MinimalUser {
  return { uid }
}

describe('firebaseAuthStore token refresh gating', () => {
  let onAuthStateChangedCallback:
    | ((user: MinimalUser | null) => void)
    | undefined
  let onIdTokenChangedCallback: ((user: MinimalUser | null) => void) | undefined
  let store: any

  beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()
    setActivePinia(createPinia())

    const authInstance = {}
    vi.mocked(vuefire.useFirebaseAuth).mockReturnValue(authInstance as any)

    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((...args) => {
      const callback = args[1] as (user: MinimalUser | null) => void
      onAuthStateChangedCallback = callback
      return vi.fn()
    })

    vi.mocked(firebaseAuth.onIdTokenChanged).mockImplementation((...args) => {
      const callback = args[1] as (user: MinimalUser | null) => void
      onIdTokenChangedCallback = callback
      return vi.fn()
    })

    const { useFirebaseAuthStore } = await import('@/stores/firebaseAuthStore')
    store = useFirebaseAuthStore()
  })

  it('skips initial token for a user and increments on subsequent refresh', () => {
    const user = makeUser('user-123')

    onIdTokenChangedCallback?.(user)
    expect(store.tokenRefreshTrigger).toBe(0)

    onIdTokenChangedCallback?.(user)
    expect(store.tokenRefreshTrigger).toBe(1)
  })

  it('does not increment when uid changes; increments on next refresh for new user', () => {
    const userA = makeUser('user-a')
    const userB = makeUser('user-b')

    onIdTokenChangedCallback?.(userA)
    expect(store.tokenRefreshTrigger).toBe(0)

    onIdTokenChangedCallback?.(userB)
    expect(store.tokenRefreshTrigger).toBe(0)

    onIdTokenChangedCallback?.(userB)
    expect(store.tokenRefreshTrigger).toBe(1)
  })

  it('resets gating after logout; first token after logout is skipped', () => {
    const user = makeUser('user-x')

    onIdTokenChangedCallback?.(user)
    onIdTokenChangedCallback?.(user)
    expect(store.tokenRefreshTrigger).toBe(1)

    onAuthStateChangedCallback?.(null)

    onIdTokenChangedCallback?.(user)
    expect(store.tokenRefreshTrigger).toBe(1)

    onIdTokenChangedCallback?.(user)
    expect(store.tokenRefreshTrigger).toBe(2)
  })
})
