import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Auth, User, UserCredential } from 'firebase/auth'

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
    signOut: vi.fn(async () => {})
  }
})

const app = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' }))
}))

vi.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: app.initializeApp
}))

vi.mock('firebase/auth', () => ({
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
  signOut: sdk.signOut
}))

async function makeIdentity() {
  const { createFirebaseIdentity } = await import('./index.js')
  return createFirebaseIdentity({ options: { apiKey: 'test' } })
}

const hostAuth = { name: 'host-auth' } as Partial<Auth> as Auth

async function makeHostBoundIdentity(actionTimeoutMs?: number) {
  const { createFirebaseIdentity } = await import('./index.js')
  return createFirebaseIdentity({ auth: hostAuth, actionTimeoutMs })
}

const testUser = { uid: 'user-1' } as Partial<User> as User
const testCredential = {
  user: testUser
} as Partial<UserCredential> as UserCredential

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

  it('leaves the network-shaped actions unbounded unless the host asks for a ceiling', async () => {
    const identity = await makeHostBoundIdentity()
    const settled = vi.fn()
    identity.signInWithEmail('a@b.example', 'hunter22!').then(settled, settled)

    await vi.advanceTimersByTimeAsync(15_000 * 10)

    expect(
      settled,
      'the cloud app runs these calls without a timeout; adopting the entry must not add one'
    ).not.toHaveBeenCalled()
  })

  it('applies the ceiling the host asks for', async () => {
    const identity = await makeHostBoundIdentity(2_000)
    const outcome = vi.fn()
    identity.sendPasswordReset('a@b.example').catch(outcome)

    await vi.advanceTimersByTimeAsync(2_000 + 10)

    expect(outcome).toHaveBeenCalledOnce()
  })
})

describe('createFirebaseIdentity action ceilings', () => {
  it.for([
    ['signInWithEmail', () => sdk.signInWithEmailAndPassword],
    ['createUserWithEmail', () => sdk.createUserWithEmailAndPassword],
    ['sendPasswordReset', () => sdk.sendPasswordResetEmail]
  ] as const)(
    'bounds %s so a hung network call cannot lock a form forever',
    async ([method]) => {
      const identity = await makeIdentity()
      const pending =
        method === 'sendPasswordReset'
          ? identity.sendPasswordReset('a@b.example')
          : identity[method]('a@b.example', 'hunter22!')
      const outcome = vi.fn()
      pending.catch(outcome)

      await vi.advanceTimersByTimeAsync(15_000 + 10)

      expect(
        outcome,
        'a network-shaped auth call with no ceiling strands the form in its pending state'
      ).toHaveBeenCalledOnce()
    }
  )

  it('leaves the interactive popup unbounded', async () => {
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

  it('resolves an email sign-in with the credential before the ceiling', async () => {
    sdk.signInWithEmailAndPassword.mockResolvedValueOnce(testCredential)
    const identity = await makeIdentity()

    await expect(
      identity.signInWithEmail('a@b.example', 'hunter22!'),
      'the action ceiling must never swallow a sign-in that completed in time'
    ).resolves.toBe(testCredential)
  })

  it('propagates an email sign-in failure as the SDK error, not a timeout', async () => {
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

  it('resolves a password reset that completes before the ceiling', async () => {
    sdk.sendPasswordResetEmail.mockResolvedValueOnce(undefined)
    const identity = await makeIdentity()

    await expect(
      identity.sendPasswordReset('a@b.example'),
      'the action ceiling must never swallow a reset that completed in time'
    ).resolves.toBeUndefined()
  })

  it('propagates a password-reset failure as the SDK error, not a timeout', async () => {
    sdk.sendPasswordResetEmail.mockRejectedValueOnce(
      new Error('auth/user-not-found')
    )
    const identity = await makeIdentity()

    await expect(identity.sendPasswordReset('a@b.example')).rejects.toThrow(
      'auth/user-not-found'
    )
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
