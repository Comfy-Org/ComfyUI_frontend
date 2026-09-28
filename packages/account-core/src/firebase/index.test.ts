import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Auth, User, UserCredential } from 'firebase/auth'

import type { FirebaseIdentityConfig } from './index.js'

const sdk = vi.hoisted(() => {
  const unsubscribe = vi.fn()
  const listeners: Array<(user: unknown) => void> = []
  const tokenListeners: Array<(user: unknown) => void> = []
  const resolvedAuth: { currentUser: unknown } = { currentUser: null }
  return {
    unsubscribe,
    listeners,
    tokenListeners,
    resolvedAuth,
    browserPopupRedirectResolver: { resolver: 'popup' },
    getAuth: vi.fn(() => resolvedAuth),
    initializeAuth: vi.fn(() => resolvedAuth),
    onAuthStateChanged: vi.fn(
      (_auth: unknown, next: (user: unknown) => void) => {
        listeners.push(next)
        return unsubscribe
      }
    ),
    onIdTokenChanged: vi.fn((_auth: unknown, next: (user: unknown) => void) => {
      tokenListeners.push(next)
      return unsubscribe
    }),
    signInWithEmailAndPassword: vi.fn(() => new Promise(() => {})),
    createUserWithEmailAndPassword: vi.fn(() => new Promise(() => {})),
    sendPasswordResetEmail: vi.fn(() => new Promise(() => {})),
    signInWithPopup: vi.fn(() => new Promise(() => {})),
    signOut: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {})
  }
})

const app = vi.hoisted(() => ({
  existing: [] as Array<{ name: string; options?: unknown }>,
  initializeApp: vi.fn((_options: unknown, name: string) => ({ name }))
}))

vi.mock<unknown>(import('firebase/app'), () => ({
  getApps: () => app.existing,
  initializeApp: app.initializeApp
}))

vi.mock<unknown>(import('firebase/auth'), () => ({
  GoogleAuthProvider: class {
    addScope() {}
    setCustomParameters() {}
  },
  GithubAuthProvider: class {
    addScope() {}
    setCustomParameters() {}
  },
  browserPopupRedirectResolver: sdk.browserPopupRedirectResolver,
  getAuth: sdk.getAuth,
  initializeAuth: sdk.initializeAuth,
  onAuthStateChanged: sdk.onAuthStateChanged,
  onIdTokenChanged: sdk.onIdTokenChanged,
  signInWithPopup: sdk.signInWithPopup,
  signInWithEmailAndPassword: sdk.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: sdk.createUserWithEmailAndPassword,
  sendPasswordResetEmail: sdk.sendPasswordResetEmail,
  signOut: sdk.signOut,
  updatePassword: sdk.updatePassword
}))

async function makeIdentity() {
  const { createFirebaseIdentity } = await import('./index.js')
  return createFirebaseIdentity({ options: { apiKey: 'test' } })
}

const hostAuth = { name: 'host-auth' } as Partial<Auth> as Auth

const localStore = { type: 'LOCAL', store: 'localStorage' } as const
const indexedDbStore = { type: 'LOCAL', store: 'indexedDB' } as const
const sessionStore = { type: 'SESSION', store: 'sessionStorage' } as const

async function makeHostBoundIdentity() {
  const { createFirebaseIdentity } = await import('./index.js')
  return createFirebaseIdentity({ auth: hostAuth })
}

const testUser = { uid: 'user-1' } as Partial<User> as User
const testCredential = {
  user: testUser
} as Partial<UserCredential> as UserCredential

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetModules()
  sdk.listeners.length = 0
  sdk.tokenListeners.length = 0
  sdk.resolvedAuth.currentUser = null
  app.existing.length = 0
  app.initializeApp.mockClear()
  vi.useFakeTimers()
})

describe('createFirebaseIdentity over package-initialized Firebase', () => {
  it('initializes the app under the explicit default name, so a persisted session keyed by [DEFAULT] is restored', async () => {
    const { createFirebaseIdentity } = await import('./index.js')
    const identity = createFirebaseIdentity({
      options: { apiKey: 'test' },
      appName: '[DEFAULT]'
    })

    identity.onUserChanged(() => {})

    expect(app.initializeApp).toHaveBeenCalledWith(
      { apiKey: 'test' },
      '[DEFAULT]'
    )
  })

  it('reuses an app another entry already created under that name', async () => {
    const existingApp = { name: '[DEFAULT]', options: { apiKey: 'test' } }
    app.existing.push(existingApp)
    const { createFirebaseIdentity } = await import('./index.js')
    const identity = createFirebaseIdentity({
      options: { apiKey: 'test' },
      appName: '[DEFAULT]'
    })

    identity.onUserChanged(() => {})

    expect(app.initializeApp).not.toHaveBeenCalled()
    expect(sdk.getAuth).toHaveBeenCalledWith(existingApp)
  })

  it("applies the host persistence to an app another script already created, so its Auth is not left on platform defaults or silently on that script's dependencies", async () => {
    const existingApp = { name: '[DEFAULT]', options: { apiKey: 'test' } }
    app.existing.push(existingApp)
    const { createFirebaseIdentity } = await import('./index.js')
    const identity = createFirebaseIdentity({
      options: { apiKey: 'test' },
      appName: '[DEFAULT]',
      persistence: [localStore, indexedDbStore]
    })

    identity.onUserChanged(() => {})

    expect(app.initializeApp).not.toHaveBeenCalled()
    expect(sdk.initializeAuth).toHaveBeenCalledWith(existingApp, {
      persistence: [localStore, indexedDbStore],
      popupRedirectResolver: sdk.browserPopupRedirectResolver
    })
    expect(sdk.getAuth).not.toHaveBeenCalled()
  })

  it('runs the host config thunk before reusing an existing app, so a resolve before remote config loads still fails closed', async () => {
    app.existing.push({ name: '[DEFAULT]', options: { apiKey: 'test' } })
    const options = vi.fn(() => {
      throw new Error('remote config not loaded')
    })
    const { createFirebaseIdentity } = await import('./index.js')
    const identity = createFirebaseIdentity({ options, appName: '[DEFAULT]' })

    expect(() => identity.initialize()).toThrow('remote config not loaded')
    expect(sdk.getAuth).not.toHaveBeenCalled()
  })

  it('throws instead of binding Auth to an existing app from a different project', async () => {
    app.existing.push({
      name: '[DEFAULT]',
      options: { apiKey: 'other', projectId: 'other-project' }
    })
    const { createFirebaseIdentity } = await import('./index.js')
    const identity = createFirebaseIdentity({
      options: { apiKey: 'test', projectId: 'this-project' },
      appName: '[DEFAULT]'
    })

    expect(() => identity.initialize()).toThrow(/different project/)
    expect(sdk.getAuth).not.toHaveBeenCalled()
    expect(sdk.initializeAuth).not.toHaveBeenCalled()
  })

  it.for([
    { shape: 'a single persistence', persistence: localStore },
    {
      shape: 'an ordered hierarchy',
      persistence: [localStore, indexedDbStore, sessionStore]
    }
  ])(
    'initializes Auth with $shape as the host listed it plus the popup resolver, since initializeAuth wires none and popup sign-in would throw auth/argument-error',
    async ({ persistence }) => {
      const { createFirebaseIdentity } = await import('./index.js')
      const identity = createFirebaseIdentity({
        options: { apiKey: 'test' },
        persistence
      })

      identity.onUserChanged(() => {})

      expect(sdk.initializeAuth).toHaveBeenCalledWith(
        { name: 'comfy-account' },
        {
          persistence,
          popupRedirectResolver: sdk.browserPopupRedirectResolver
        }
      )
      expect(sdk.getAuth).not.toHaveBeenCalled()
    }
  )

  it('stays on getAuth when the host chooses no persistence', async () => {
    const identity = await makeIdentity()

    identity.onUserChanged(() => {})

    expect(sdk.getAuth).toHaveBeenCalledWith({ name: 'comfy-account' })
    expect(sdk.initializeAuth).not.toHaveBeenCalled()
  })

  it('reads an options thunk only when the app first resolves, and once', async () => {
    const options = vi.fn(() => ({ apiKey: 'from-thunk' }))
    const { createFirebaseIdentity } = await import('./index.js')
    const identity = createFirebaseIdentity({ options })

    expect(options).not.toHaveBeenCalled()

    identity.initialize()
    identity.initialize()
    identity.onUserChanged(() => {})

    expect(options).toHaveBeenCalledOnce()
    expect(app.initializeApp).toHaveBeenCalledWith(
      { apiKey: 'from-thunk' },
      'comfy-account'
    )
  })

  it('resolves once no matter how often initialize() is called', async () => {
    const identity = await makeIdentity()

    identity.initialize()
    identity.initialize()

    expect(app.initializeApp).toHaveBeenCalledOnce()
    expect(sdk.getAuth).toHaveBeenCalledOnce()
  })
})

describe('createFirebaseIdentity over a host-owned Auth', () => {
  it('binds every action and the listener to the given instance without initializing an app', async () => {
    sdk.signInWithPopup.mockResolvedValueOnce(testCredential)
    sdk.signInWithEmailAndPassword.mockResolvedValueOnce(testCredential)
    const identity = await makeHostBoundIdentity()

    identity.onUserChanged(() => {})
    await identity.signInWithGoogle()
    await identity.signInWithEmail('a@b.example', 'hunter22!')
    await identity.signOut()

    expect(
      app.initializeApp,
      'a second Firebase app would hold its own persistence and split the session'
    ).not.toHaveBeenCalled()
    for (const call of [
      sdk.onAuthStateChanged,
      sdk.signInWithPopup,
      sdk.signInWithEmailAndPassword,
      sdk.signOut
    ]) {
      expect(call).toHaveBeenLastCalledWith(
        hostAuth,
        ...call.mock.lastCall!.slice(1)
      )
    }
  })
})

describe('createFirebaseIdentity state-changing calls stay pending until the SDK settles', () => {
  it.for([['signInWithEmail'], ['sendPasswordReset']] as const)(
    'keeps the %s caller pending past any deadline until the SDK op settles (FE-2172)',
    async ([method]) => {
      const call = deferred<UserCredential>()
      const sdkCall =
        method === 'sendPasswordReset'
          ? sdk.sendPasswordResetEmail
          : sdk.signInWithEmailAndPassword
      sdkCall.mockReturnValueOnce(call.promise)
      const identity = await makeIdentity()

      const attempt =
        method === 'sendPasswordReset'
          ? identity.sendPasswordReset('a@b.example')
          : identity.signInWithEmail('a@b.example', 'stalled')
      const settled = vi.fn()
      attempt.then(settled, settled)

      await vi.advanceTimersByTimeAsync(15_000 * 10)

      expect(
        settled,
        'the caller must not be released on any deadline while the SDK op is still running'
      ).not.toHaveBeenCalled()

      call.resolve(testCredential)
      await vi.advanceTimersByTimeAsync(0)

      expect(
        settled,
        'the caller settles only once the underlying SDK op does'
      ).toHaveBeenCalledOnce()
    }
  )

  it('never bounds account creation: a released caller with a live SDK call orphans the account', async () => {
    const identity = await makeIdentity()
    const settled = vi.fn()
    identity
      .createUserWithEmail('a@b.example', 'hunter22!')
      .then(settled, settled)

    await vi.advanceTimersByTimeAsync(15_000 * 10)

    expect(
      settled,
      'a rejected caller with a still-running SDK call orphans the account; every retry then fails email-already-in-use'
    ).not.toHaveBeenCalled()
  })

  it('leaves the interactive popup pending on the caller', async () => {
    const identity = await makeIdentity()
    const settled = vi.fn()
    identity.signInWithGoogle().then(settled, settled)

    await vi.advanceTimersByTimeAsync(15_000 * 10)

    expect(
      settled,
      'a user may legitimately take minutes in the popup; the SDK owns its cancellation errors'
    ).not.toHaveBeenCalled()
  })
})

describe('createFirebaseIdentity exclusive config', () => {
  it('cannot represent a config carrying both a host Auth and package app options', () => {
    const both = { auth: hostAuth, options: { apiKey: 'test' } }
    const asConfig = (config: FirebaseIdentityConfig): FirebaseIdentityConfig =>
      config
    // @ts-expect-error a config cannot carry both a host Auth and package app options
    asConfig(both)

    expect(
      both,
      'compile-time exclusivity guard; the runtime body only anchors the @ts-expect-error'
    ).toBeDefined()
  })
})

describe('sign-in and sign-out delegation', () => {
  it.for([['signInWithGoogle'], ['signInWithGitHub']] as const)(
    'resolves %s with the credential the popup returns',
    async ([method]) => {
      sdk.signInWithPopup.mockResolvedValueOnce(testCredential)
      const identity = await makeIdentity()

      await expect(identity[method]()).resolves.toBe(testCredential)
    }
  )

  it.for([['signInWithGoogle'], ['signInWithGitHub']] as const)(
    'propagates a popup failure from %s to the caller',
    async ([method]) => {
      sdk.signInWithPopup.mockRejectedValueOnce(
        new Error('auth/popup-closed-by-user')
      )
      const identity = await makeIdentity()

      await expect(identity[method]()).rejects.toThrow(
        'auth/popup-closed-by-user'
      )
    }
  )

  it('resolves an email sign-in with the credential', async () => {
    sdk.signInWithEmailAndPassword.mockResolvedValueOnce(testCredential)
    const identity = await makeIdentity()

    await expect(
      identity.signInWithEmail('a@b.example', 'hunter22!')
    ).resolves.toBe(testCredential)
  })

  it('propagates an email sign-in failure as the SDK error', async () => {
    sdk.signInWithEmailAndPassword.mockRejectedValueOnce(
      new Error('auth/wrong-password')
    )
    const identity = await makeIdentity()

    await expect(
      identity.signInWithEmail('a@b.example', 'wrong')
    ).rejects.toThrow('auth/wrong-password')
  })

  it('signs out through the SDK', async () => {
    const identity = await makeIdentity()

    await expect(identity.signOut()).resolves.toBeUndefined()
    expect(sdk.signOut).toHaveBeenCalledOnce()
  })

  it('resolves a password reset', async () => {
    sdk.sendPasswordResetEmail.mockResolvedValueOnce(undefined)
    const identity = await makeIdentity()

    await expect(
      identity.sendPasswordReset('a@b.example')
    ).resolves.toBeUndefined()
  })

  it('propagates a password-reset failure as the SDK error', async () => {
    sdk.sendPasswordResetEmail.mockRejectedValueOnce(
      new Error('auth/network-request-failed')
    )
    const identity = await makeIdentity()

    await expect(identity.sendPasswordReset('a@b.example')).rejects.toThrow(
      'auth/network-request-failed'
    )
  })

  it('resolves a password reset for an unknown email as if it were sent', async () => {
    sdk.sendPasswordResetEmail.mockRejectedValueOnce({
      code: 'auth/user-not-found',
      message: 'Firebase: Error (auth/user-not-found).'
    })
    const identity = await makeIdentity()

    await expect(
      identity.sendPasswordReset('ghost@b.example'),
      'a reset that fails only for unknown emails tells the caller which emails have accounts'
    ).resolves.toBeUndefined()
  })

  it('updates the password of the signed-in user through the SDK', async () => {
    const user = { uid: 'u1' } as Partial<User> as User
    const { createFirebaseIdentity } = await import('./index.js')
    const identity = createFirebaseIdentity({
      auth: { ...hostAuth, currentUser: user } as Partial<Auth> as Auth
    })

    await identity.updatePassword('hunter22!!')

    expect(sdk.updatePassword).toHaveBeenCalledWith(user, 'hunter22!!')
  })

  it('rejects a password update when nobody is signed in', async () => {
    const identity = await makeHostBoundIdentity()

    await expect(identity.updatePassword('hunter22!!')).rejects.toThrow(
      'No signed-in user'
    )
    expect(sdk.updatePassword).not.toHaveBeenCalled()
  })

  it('propagates a sign-out failure to the caller', async () => {
    sdk.signOut.mockRejectedValueOnce(new Error('auth/network-request-failed'))
    const identity = await makeIdentity()

    await expect(identity.signOut()).rejects.toThrow(
      'auth/network-request-failed'
    )
  })
})

describe('identity listener', () => {
  it('delivers every auth-state change Firebase fires, sign-out included', async () => {
    const identity = await makeIdentity()
    const seen: Array<User | null> = []
    identity.onUserChanged((user) => seen.push(user))

    sdk.listeners.forEach((next) => next(testUser))
    sdk.listeners.forEach((next) => next(null))

    expect(
      seen,
      'the session core relies on this port relaying both the restored user and the sign-out null'
    ).toEqual([testUser, null])
  })

  it('detaches the Firebase listener on unsubscribe', async () => {
    const identity = await makeIdentity()
    const unsubscribe = identity.onUserChanged(() => undefined)

    unsubscribe()

    expect(sdk.unsubscribe).toHaveBeenCalledOnce()
  })

  it('delivers every ID token change, refreshes for the same user included', async () => {
    const identity = await makeIdentity()
    const seen: Array<User | null> = []
    identity.onTokenChanged((user) => seen.push(user))

    sdk.tokenListeners.forEach((next) => next(testUser))
    sdk.tokenListeners.forEach((next) => next(testUser))
    sdk.tokenListeners.forEach((next) => next(null))

    expect(seen).toEqual([testUser, testUser, null])
  })

  it('detaches the token listener on unsubscribe', async () => {
    const identity = await makeIdentity()
    const unsubscribe = identity.onTokenChanged(() => undefined)

    unsubscribe()

    expect(sdk.unsubscribe).toHaveBeenCalledOnce()
  })

  it('reports no user before Auth is resolved, without resolving it', async () => {
    sdk.resolvedAuth.currentUser = testUser
    const identity = await makeIdentity()

    expect(
      identity.currentUser(),
      'a read-only query must not initialize the app: a host reads it before its config is loaded'
    ).toBeNull()
    expect(app.initializeApp).not.toHaveBeenCalled()
    expect(sdk.getAuth).not.toHaveBeenCalled()
  })

  it.for([
    ['nobody signed in', null],
    ['a signed-in user', testUser]
  ] as const)(
    'reads %s from the Auth instance once initialize() resolved it',
    async ([, user]) => {
      sdk.resolvedAuth.currentUser = user
      const identity = await makeIdentity()

      identity.initialize()

      expect(identity.currentUser()).toBe(user)
    }
  )
})

describe('resolveFirebaseIdentity', () => {
  const VALID_CONFIG = {
    apiKey: 'api-key',
    authDomain: 'cloud.firebaseapp.com',
    projectId: 'cloud',
    appId: '1:1:web:1'
  }

  function jsonFetch(body: unknown, status = 200): typeof fetch {
    return vi.fn(async () => new Response(JSON.stringify(body), { status }))
  }

  it('resolves a ready, initialized identity from a well-formed /api/features response', async () => {
    vi.stubGlobal('fetch', jsonFetch({ firebase_config: VALID_CONFIG }))
    const { resolveFirebaseIdentity } = await import('./index.js')

    const identity = await resolveFirebaseIdentity({
      cloudBaseUrl: 'https://cloud.example',
      appName: 'well-formed'
    })

    expect(identity).toBeDefined()
    expect(app.initializeApp).toHaveBeenCalledWith(VALID_CONFIG, 'well-formed')
    expect(sdk.getAuth).toHaveBeenCalledOnce()
  })

  it.for([
    [
      'a non-OK response',
      () => jsonFetch({ firebase_config: VALID_CONFIG }, 500)
    ],
    [
      'a malformed body',
      () => vi.fn(async () => new Response('not json', { status: 200 }))
    ],
    [
      'a missing required field',
      () =>
        jsonFetch({
          firebase_config: { ...VALID_CONFIG, apiKey: undefined }
        })
    ],
    [
      'a network failure',
      () =>
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        })
    ]
  ] as const)(
    'settles no identity, never a rejection, on %s',
    async ([label, makeFetch]) => {
      vi.stubGlobal('fetch', makeFetch())
      const { resolveFirebaseIdentity } = await import('./index.js')

      await expect(
        resolveFirebaseIdentity({
          cloudBaseUrl: 'https://cloud.example',
          appName: label.replace(/\s+/g, '-')
        })
      ).resolves.toBeUndefined()
    }
  )

  it('settles no identity when the fetch outruns the timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
    )
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity } = await import('./index.js')

    const result = resolveFirebaseIdentity({
      cloudBaseUrl: 'https://cloud.example',
      appName: 'slow',
      timeoutMs: 5
    })
    await vi.advanceTimersByTimeAsync(5)

    await expect(result).resolves.toBeUndefined()
  })

  it('settles no identity, not a throw, when a well-formed config fails the SDK’s own checks', async () => {
    // Same app name already registered for a different project: initialize()
    // throws from assertSameProject instead of resolving Auth.
    app.existing.push({
      name: 'bad-init',
      options: { apiKey: 'other', projectId: 'other-project' }
    })
    vi.stubGlobal('fetch', jsonFetch({ firebase_config: VALID_CONFIG }))
    const { resolveFirebaseIdentity } = await import('./index.js')

    await expect(
      resolveFirebaseIdentity({
        cloudBaseUrl: 'https://cloud.example',
        appName: 'bad-init'
      })
    ).resolves.toBeUndefined()
  })

  it('fetches once and shares the resolved identity across concurrent callers with the same pair', async () => {
    const fetchImpl = jsonFetch({ firebase_config: VALID_CONFIG })
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity } = await import('./index.js')
    const options = {
      cloudBaseUrl: 'https://cloud.example',
      appName: 'memo-app'
    }

    const [first, second] = await Promise.all([
      resolveFirebaseIdentity(options),
      resolveFirebaseIdentity(options)
    ])

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(first).toBe(second)
  })

  it('keys memoization by cloudBaseUrl: two origins under the same app name do not share a result', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const projectId = new URL(url).hostname
      return new Response(
        JSON.stringify({
          firebase_config: { ...VALID_CONFIG, projectId }
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity } = await import('./index.js')

    const [fromOne, fromTwo] = await Promise.all([
      resolveFirebaseIdentity({
        cloudBaseUrl: 'https://one.example',
        appName: 'shared-app-name'
      }),
      resolveFirebaseIdentity({
        cloudBaseUrl: 'https://two.example',
        appName: 'shared-app-name'
      })
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fromOne).not.toBe(fromTwo)
  })

  it('does not cache a failed resolution: a later call re-fetches and can succeed', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ firebase_config: VALID_CONFIG }), {
          status: 200
        })
      )
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity } = await import('./index.js')
    const options = {
      cloudBaseUrl: 'https://cloud.example',
      appName: 'evict-on-failure'
    }

    const first = await resolveFirebaseIdentity(options)
    expect(first).toBeUndefined()
    const second = await resolveFirebaseIdentity(options)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(second).toBeDefined()
  })

  it('shares one in-flight fetch even when it will end in failure', async () => {
    const response = deferred<Response>()
    const fetchImpl = vi.fn<typeof fetch>(() => response.promise)
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity } = await import('./index.js')
    const options = {
      cloudBaseUrl: 'https://cloud.example',
      appName: 'concurrent-failure'
    }

    const callA = resolveFirebaseIdentity(options)
    const callB = resolveFirebaseIdentity(options)
    response.resolve(new Response('not json', { status: 200 }))

    const [a, b] = await Promise.all([callA, callB])
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(a).toBeUndefined()
    expect(b).toBeUndefined()
  })

  it('keeps a successful resolution cached: a later call does not re-fetch', async () => {
    const fetchImpl = jsonFetch({ firebase_config: VALID_CONFIG })
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity } = await import('./index.js')
    const options = {
      cloudBaseUrl: 'https://cloud.example',
      appName: 'stays-cached'
    }

    const first = await resolveFirebaseIdentity(options)
    const second = await resolveFirebaseIdentity(options)

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(first).toBe(second)
  })
})

describe('resolveStripePublishableKey', () => {
  function jsonFetch(body: unknown, status = 200): typeof fetch {
    return vi.fn(async () => new Response(JSON.stringify(body), { status }))
  }

  it('resolves the key from a well-formed /api/features response', async () => {
    vi.stubGlobal('fetch', jsonFetch({ stripe_publishable_key: 'pk_live_123' }))
    const { resolveStripePublishableKey } = await import('./index.js')

    await expect(
      resolveStripePublishableKey({ cloudBaseUrl: 'https://cloud.example' })
    ).resolves.toBe('pk_live_123')
  })

  it('settles undefined, never a rejection, when the server has no key configured', async () => {
    vi.stubGlobal('fetch', jsonFetch({}))
    const { resolveStripePublishableKey } = await import('./index.js')

    await expect(
      resolveStripePublishableKey({ cloudBaseUrl: 'https://cloud.example' })
    ).resolves.toBeUndefined()
  })

  it('shares one /api/features fetch with resolveFirebaseIdentity on the same cloudBaseUrl and timeoutMs', async () => {
    const fetchImpl = jsonFetch({
      firebase_config: {
        apiKey: 'api-key',
        authDomain: 'cloud.firebaseapp.com',
        projectId: 'cloud',
        appId: '1:1:web:1'
      },
      stripe_publishable_key: 'pk_live_123'
    })
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity, resolveStripePublishableKey } =
      await import('./index.js')
    const options = {
      cloudBaseUrl: 'https://shared.example',
      timeoutMs: 4000
    }

    const [identity, key] = await Promise.all([
      resolveFirebaseIdentity({ ...options, appName: 'shared-fetch-app' }),
      resolveStripePublishableKey(options)
    ])

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(identity).toBeDefined()
    expect(key).toBe('pk_live_123')
  })

  it('does not cache a failed features fetch across consumers: a later call on the same pair re-fetches and succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            firebase_config: {
              apiKey: 'api-key',
              authDomain: 'cloud.firebaseapp.com',
              projectId: 'cloud',
              appId: '1:1:web:1'
            }
          }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveFirebaseIdentity, resolveStripePublishableKey } =
      await import('./index.js')
    const options = { cloudBaseUrl: 'https://cloud.example' }

    const failedKey = await resolveStripePublishableKey(options)
    expect(failedKey).toBeUndefined()
    const identity = await resolveFirebaseIdentity({
      ...options,
      appName: 'evict-across-consumers'
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(identity).toBeDefined()
  })

  it('recovers the Stripe key the same way: a failed fetch, then a later resolution yields the server key', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ stripe_publishable_key: 'pk_live_123' }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveStripePublishableKey } = await import('./index.js')
    const options = { cloudBaseUrl: 'https://cloud.example' }

    const first = await resolveStripePublishableKey(options)
    expect(first).toBeUndefined()
    const second = await resolveStripePublishableKey(options)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(second).toBe('pk_live_123')
  })

  it('shares one in-flight fetch across concurrent callers on the same pair', async () => {
    const response = deferred<Response>()
    const fetchImpl = vi.fn<typeof fetch>(() => response.promise)
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveStripePublishableKey } = await import('./index.js')
    const options = { cloudBaseUrl: 'https://cloud.example' }

    const callA = resolveStripePublishableKey(options)
    const callB = resolveStripePublishableKey(options)
    response.resolve(
      new Response(JSON.stringify({ stripe_publishable_key: 'pk_live_123' }), {
        status: 200
      })
    )

    const [a, b] = await Promise.all([callA, callB])
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(a).toBe('pk_live_123')
    expect(b).toBe('pk_live_123')
  })

  it('keeps a successful features fetch cached: a later call does not re-fetch', async () => {
    const fetchImpl = jsonFetch({ stripe_publishable_key: 'pk_live_123' })
    vi.stubGlobal('fetch', fetchImpl)
    const { resolveStripePublishableKey } = await import('./index.js')
    const options = { cloudBaseUrl: 'https://cloud.example' }

    const first = await resolveStripePublishableKey(options)
    const second = await resolveStripePublishableKey(options)

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(first).toBe('pk_live_123')
    expect(second).toBe('pk_live_123')
  })
})

describe('resolveWebSessionProbe', () => {
  function jsonFetch(body: unknown): typeof fetch {
    return vi.fn(async () => new Response(JSON.stringify(body)))
  }

  it.for([
    { body: { stripe_publishable_key: 'pk' }, expected: false },
    {
      body: { stripe_publishable_key: 'pk', web_session_probe: false },
      expected: false
    },
    {
      body: { stripe_publishable_key: 'pk', web_session_probe: true },
      expected: true
    }
  ])(
    'reads $body from the fetch resolveStripePublishableKey already shares',
    async ({ body, expected }) => {
      const fetchImpl = jsonFetch(body)
      vi.stubGlobal('fetch', fetchImpl)
      const { resolveStripePublishableKey, resolveWebSessionProbe } =
        await import('./index.js')
      const options = { cloudBaseUrl: 'https://probe.example', timeoutMs: 4000 }

      const [, probe] = await Promise.all([
        resolveStripePublishableKey(options),
        resolveWebSessionProbe(options)
      ])

      expect(probe).toBe(expected)
      expect(fetchImpl).toHaveBeenCalledOnce()
    }
  )
})
