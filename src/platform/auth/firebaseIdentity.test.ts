import { fromPartial } from '@total-typescript/shoehorn'
import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('initializes the default app from the remote config present at initialize(), not at import, reading localStorage, then the IndexedDB store vuefire persisted sessions in, then session storage, with the popup resolver', async () => {
    const {
      firebaseIdentity,
      initializeApp,
      initializeAuth,
      browserLocalPersistence,
      browserSessionPersistence,
      indexedDBLocalPersistence,
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
      persistence: [
        browserLocalPersistence,
        indexedDBLocalPersistence,
        browserSessionPersistence
      ],
      popupRedirectResolver: browserPopupRedirectResolver
    })
    const persistence =
      vi.mocked(initializeAuth).mock.lastCall?.[1]?.persistence
    assert(Array.isArray(persistence))
    expect(persistence[0]).toBe(browserLocalPersistence)
    expect(persistence[1]).toBe(indexedDBLocalPersistence)
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

  it('refuses to resolve while remote config is unloaded outside DEV too, where a soft assertion would report and boot on build-time config', async () => {
    vi.stubEnv('DEV', false)
    const { firebaseIdentity, initializeApp, remoteConfigState } =
      await loadFresh()
    remoteConfigState.value = 'unloaded'

    expect(() => firebaseIdentity.initialize()).toThrow(/remote config/)
    expect(initializeApp).not.toHaveBeenCalled()
  })

  it('boots on the build-time fallback config, without asserting, when the config fetch failed', async () => {
    const {
      firebaseIdentity,
      initializeApp,
      initializeAuth,
      remoteConfig,
      remoteConfigState
    } = await loadFresh()
    vi.mocked(initializeApp).mockReturnValue(defaultApp)
    vi.mocked(initializeAuth).mockReturnValue(fromPartial<Auth>({}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    remoteConfigState.value = 'error'
    remoteConfig.value = {}

    firebaseIdentity.initialize()

    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'dreamboothy-dev' }),
      '[DEFAULT]'
    )
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('initializes Auth on an existing [DEFAULT] app with the same persistence list and popup resolver instead of taking whatever its creator chose', async () => {
    const {
      firebaseIdentity,
      getApps,
      getAuth,
      initializeApp,
      initializeAuth,
      browserLocalPersistence,
      browserSessionPersistence,
      indexedDBLocalPersistence,
      browserPopupRedirectResolver
    } = await loadFresh()
    vi.mocked(getApps).mockReturnValue([defaultApp])
    vi.mocked(initializeAuth).mockReturnValue(
      fromPartial<Auth>({ currentUser: signedIn })
    )

    firebaseIdentity.initialize()

    expect(initializeAuth).toHaveBeenCalledWith(defaultApp, {
      persistence: [
        browserLocalPersistence,
        indexedDBLocalPersistence,
        browserSessionPersistence
      ],
      popupRedirectResolver: browserPopupRedirectResolver
    })
    expect(firebaseIdentity.currentUser()).toBe(signedIn)
    expect(initializeApp).not.toHaveBeenCalled()
    expect(getAuth).not.toHaveBeenCalled()
  })
})
