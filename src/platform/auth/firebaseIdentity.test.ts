import { fromPartial } from '@total-typescript/shoehorn'
import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('firebase/app'), { spy: true })
vi.mock(import('firebase/auth'))

const RUNTIME_CONFIG = {
  apiKey: 'runtime-key',
  authDomain: 'runtime.firebaseapp.com',
  projectId: 'runtime',
  storageBucket: 'runtime.appspot.com',
  messagingSenderId: '999',
  appId: '999'
}

/**
 * Each case needs an identity that has not resolved yet, so it imports a
 * fresh module graph along with the SDK and remote-config instances that
 * graph binds to.
 */
async function loadFresh() {
  vi.resetModules()
  const [identity, firebaseApp, firebaseAuth, remote] = await Promise.all([
    import('./firebaseIdentity'),
    import('firebase/app'),
    import('firebase/auth'),
    import('@/platform/remoteConfig/remoteConfig')
  ])
  return { ...identity, ...firebaseApp, ...firebaseAuth, ...remote }
}

const defaultApp = fromPartial<FirebaseApp>({ name: '[DEFAULT]' })
const signedIn = fromPartial<User>({ uid: 'user-1' })

describe('firebaseIdentity', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('initializes the default app from the remote config present at initialize(), not at import, with local persistence and the popup resolver', async () => {
    const {
      firebaseIdentity,
      initializeApp,
      initializeAuth,
      browserLocalPersistence,
      browserPopupRedirectResolver,
      remoteConfig,
      remoteConfigState
    } = await loadFresh()
    vi.mocked(initializeApp).mockReturnValue(defaultApp)
    vi.mocked(initializeAuth).mockReturnValue(
      fromPartial<Auth>({ currentUser: signedIn })
    )
    remoteConfigState.value = 'anonymous'
    remoteConfig.value = {
      ...remoteConfig.value,
      firebase_config: RUNTIME_CONFIG
    }

    firebaseIdentity.initialize()

    expect(initializeApp).toHaveBeenCalledWith(RUNTIME_CONFIG, '[DEFAULT]')
    expect(initializeAuth).toHaveBeenCalledWith(defaultApp, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver
    })
    expect(firebaseIdentity.currentUser()).toBe(signedIn)
  })

  it('refuses to resolve while remote config is still unloaded instead of booting on build-time config', async () => {
    const { firebaseIdentity, initializeApp, remoteConfigState } =
      await loadFresh()
    remoteConfigState.value = 'unloaded'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => firebaseIdentity.initialize()).toThrow(/remote config/)
    expect(initializeApp).not.toHaveBeenCalled()
  })

  it('reuses an existing [DEFAULT] app through getAuth without initializing Auth again', async () => {
    const {
      firebaseIdentity,
      getApps,
      getAuth,
      initializeApp,
      initializeAuth
    } = await loadFresh()
    vi.mocked(getApps).mockReturnValue([defaultApp])
    vi.mocked(getAuth).mockReturnValue(
      fromPartial<Auth>({ currentUser: signedIn })
    )

    firebaseIdentity.initialize()

    expect(getAuth).toHaveBeenCalledWith(defaultApp)
    expect(firebaseIdentity.currentUser()).toBe(signedIn)
    expect(initializeApp).not.toHaveBeenCalled()
    expect(initializeAuth).not.toHaveBeenCalled()
  })
})
