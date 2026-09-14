import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Auth, User, UserCredential } from 'firebase/auth'

import type { FirebaseIdentityConfig } from './index.js'

const sdk = vi.hoisted(() => {
  const unsubscribe = vi.fn()
  const listeners: Array<(user: unknown) => void> = []
  return {
    unsubscribe,
    listeners,
    onAuthStateChanged: vi.fn(
      (_auth: unknown, next: (user: unknown) => void) => {
        listeners.push(next)
        return unsubscribe
      }
    ),
    signInWithEmailAndPassword: vi.fn(() => new Promise(() => {})),
    createUserWithEmailAndPassword: vi.fn(() => new Promise(() => {})),
    sendPasswordResetEmail: vi.fn(() => new Promise(() => {})),
    signInWithPopup: vi.fn(() => new Promise(() => {})),
    signOut: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {})
  }
})

const app = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' }))
}))

vi.mock<unknown>(import('firebase/app'), () => ({
  getApps: () => [],
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
  getAuth: () => ({}),
  initializeAuth: () => ({}),
  onAuthStateChanged: sdk.onAuthStateChanged,
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
  sdk.listeners.length = 0
  app.initializeApp.mockClear()
  vi.useFakeTimers()
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
})
