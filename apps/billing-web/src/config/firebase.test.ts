import type { User } from 'firebase/auth'

import type {
  FirebaseIdentity,
  FirebaseIdentityConfig
} from '@comfyorg/account-core/firebase'
import type { RuntimeFirebaseOptions } from '@comfyorg/account-core/firebaseConfigSource'
import { createTestIdentity } from '@comfyorg/account-core/testing'

const h = vi.hoisted(() => ({
  fetchFirebaseConfig:
    vi.fn<() => Promise<RuntimeFirebaseOptions | undefined>>(),
  fallbackOptions: undefined as RuntimeFirebaseOptions | undefined,
  failInitializeFor: new Set<string>(),
  // Mirrors the real SDK: an app name that already has a different
  // project's options registered rejects, same as `assertSameProject`.
  registeredApps: new Map<string, string>()
}))

vi.mock(import('@comfyorg/account-core/firebaseConfigSource'), () => ({
  fetchFirebaseConfig: h.fetchFirebaseConfig
}))

// A structurally complete FirebaseIdentity double: a shape change on the
// interface fails this file at typecheck instead of only at runtime.
vi.mock(import('@comfyorg/account-core/firebase'), () => ({
  createFirebaseIdentity: (
    config: FirebaseIdentityConfig
  ): FirebaseIdentity => {
    if (!('options' in config) || typeof config.options === 'function') {
      throw new Error('test mock only supports direct Firebase options')
    }
    const options = config.options as RuntimeFirebaseOptions
    const appName = config.appName ?? 'comfy-account'
    const identity = {
      ...createTestIdentity<User>({
        onUserChanged: () => () => undefined
      }),
      onTokenChanged: () => () => undefined,
      initialize: () => {
        const existingProject = h.registeredApps.get(appName)
        if (existingProject && existingProject !== options.projectId) {
          throw new Error(
            `Firebase app "${appName}" already exists for a different project`
          )
        }
        h.registeredApps.set(appName, options.projectId)
        if (h.failInitializeFor.has(options.apiKey)) {
          throw new Error(`invalid config: ${options.apiKey}`)
        }
      },
      currentUser: () => null,
      signInWithGoogle: () =>
        Promise.reject(new Error('not used by this test')),
      signInWithGitHub: () =>
        Promise.reject(new Error('not used by this test')),
      signInWithEmail: () => Promise.reject(new Error('not used by this test')),
      createUserWithEmail: () =>
        Promise.reject(new Error('not used by this test')),
      sendPasswordReset: () => Promise.resolve(),
      updatePassword: () => Promise.reject(new Error('not used by this test')),
      signOut: () => Promise.resolve(),
      // Test-only marker so a test can tell which config it resolved.
      options
    }
    return identity
  }
}))

vi.mock(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org',
  get FIREBASE_OPTIONS() {
    return h.fallbackOptions
  }
}))

const RUNTIME_OPTIONS = {
  apiKey: 'runtime-key',
  authDomain: 'runtime.firebaseapp.com',
  projectId: 'runtime',
  appId: '1:1:web:runtime'
}

const FALLBACK_OPTIONS = {
  apiKey: 'fallback-key',
  authDomain: 'fallback.firebaseapp.com',
  projectId: 'fallback',
  appId: '1:1:web:fallback'
}

beforeEach(() => {
  h.fallbackOptions = undefined
  h.failInitializeFor.clear()
  h.registeredApps.clear()
})

async function freshFirebase() {
  vi.resetModules()
  return import('@/config/firebase')
}

describe('resolveBillingWebIdentity', () => {
  it('prefers the runtime configuration when the fetch returns one', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(RUNTIME_OPTIONS)
    h.fallbackOptions = FALLBACK_OPTIONS
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toMatchObject({
      options: RUNTIME_OPTIONS,
      initialize: expect.any(Function)
    })
  })

  it('falls back to the build-time options when the fetch returns nothing', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(undefined)
    h.fallbackOptions = FALLBACK_OPTIONS
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toMatchObject({
      options: FALLBACK_OPTIONS,
      initialize: expect.any(Function)
    })
  })

  it('offers no identity when neither source is configured', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(undefined)
    h.fallbackOptions = undefined
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toBeUndefined()
  })

  it('fetches once and shares the resolution across callers', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(RUNTIME_OPTIONS)
    const { resolveBillingWebIdentity } = await freshFirebase()

    await Promise.all([
      resolveBillingWebIdentity(),
      resolveBillingWebIdentity()
    ])

    expect(h.fetchFirebaseConfig).toHaveBeenCalledOnce()
  })

  it('falls back to a different-project build-time config when the runtime config fails to construct', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(RUNTIME_OPTIONS)
    h.fallbackOptions = FALLBACK_OPTIONS
    h.failInitializeFor.add(RUNTIME_OPTIONS.apiKey)
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toMatchObject({
      options: FALLBACK_OPTIONS,
      initialize: expect.any(Function)
    })
  })

  it('resolves no identity, never a rejection, when both configs fail to construct', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(RUNTIME_OPTIONS)
    h.fallbackOptions = FALLBACK_OPTIONS
    h.failInitializeFor.add(RUNTIME_OPTIONS.apiKey)
    h.failInitializeFor.add(FALLBACK_OPTIONS.apiKey)
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toBeUndefined()
  })

  it('memoizes the resolved fallback, not a rejection, so a second caller sees the same result', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(RUNTIME_OPTIONS)
    h.fallbackOptions = undefined
    h.failInitializeFor.add(RUNTIME_OPTIONS.apiKey)
    const { resolveBillingWebIdentity } = await freshFirebase()

    const [first, second] = await Promise.all([
      resolveBillingWebIdentity(),
      resolveBillingWebIdentity()
    ])

    expect(first).toBeUndefined()
    expect(second).toBeUndefined()
    expect(h.fetchFirebaseConfig).toHaveBeenCalledOnce()
  })
})
