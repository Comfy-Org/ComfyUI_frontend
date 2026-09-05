import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  app: { name: 'app' } as FirebaseApp,
  auth: { name: 'auth' } as unknown as Auth,
  authState: null as User | null,
  unsubscribe: vi.fn(),
  getApps: vi.fn<() => FirebaseApp[]>(),
  getApp: vi.fn<() => FirebaseApp>(),
  initializeApp: vi.fn<() => FirebaseApp>(),
  getAuth: vi.fn<() => Auth>(),
  onAuthStateChanged: vi.fn(),
  setPersistence: vi.fn()
}))

vi.mock('firebase/app', () => ({
  getApps: mocks.getApps,
  getApp: mocks.getApp,
  initializeApp: mocks.initializeApp
}))

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: { type: 'LOCAL' },
  browserSessionPersistence: { type: 'SESSION' },
  inMemoryPersistence: { type: 'NONE' },
  indexedDBLocalPersistence: { type: 'INDEXED_DB' },
  getAuth: mocks.getAuth,
  onAuthStateChanged: mocks.onAuthStateChanged,
  setPersistence: mocks.setPersistence
}))

import { createFirebaseIdentity } from './index.js'

describe('createFirebaseIdentity', () => {
  beforeEach(() => {
    mocks.authState = null
    mocks.getApps.mockReturnValue([])
    mocks.getApp.mockReturnValue(mocks.app)
    mocks.initializeApp.mockReturnValue(mocks.app)
    mocks.getAuth.mockReturnValue(mocks.auth)
    mocks.setPersistence.mockResolvedValue(undefined)
    mocks.onAuthStateChanged.mockImplementation(
      (_auth: Auth, listener: (user: User | null) => void) => {
        queueMicrotask(() => listener(mocks.authState))
        return mocks.unsubscribe
      }
    )
  })

  it('returns null after the first signed-out auth state', async () => {
    const identity = createFirebaseIdentity({ options: { apiKey: 'test' } })

    await expect(identity.acquire()).resolves.toBeNull()
    expect(mocks.initializeApp).toHaveBeenCalledWith({ apiKey: 'test' })
    expect(mocks.getAuth).toHaveBeenCalledWith(mocks.app)
  })

  it('returns the user identity and passes forceRefresh to token minting', async () => {
    const getIdToken = vi.fn(async () => 'token')
    mocks.authState = { uid: 'user', getIdToken } as unknown as User
    const identity = createFirebaseIdentity({ auth: mocks.auth })

    await expect(identity.acquire({ forceRefresh: true })).resolves.toEqual({
      userId: 'user',
      token: 'token'
    })
    expect(getIdToken).toHaveBeenCalledWith(true)
    expect(mocks.getAuth).not.toHaveBeenCalled()
  })

  it.for([
    ['local', 'LOCAL'],
    ['session', 'SESSION'],
    ['memory', 'NONE'],
    ['indexedDB', 'INDEXED_DB']
  ] as const)('maps %s persistence', ([persistence, type]) => {
    createFirebaseIdentity({ auth: mocks.auth, persistence })

    expect(mocks.setPersistence).toHaveBeenCalledWith(
      mocks.auth,
      expect.objectContaining({ type })
    )
  })

  it('disposes auth-state subscriptions', () => {
    const identity = createFirebaseIdentity({ auth: mocks.auth })
    identity.subscribe?.(vi.fn())

    identity.dispose()

    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
  })
})
