import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { User, UserCredential } from 'firebase/auth'

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

vi.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({ name: 'test-app' })
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

const testUser = { uid: 'user-1' } as Partial<User> as User
const testCredential = {
  user: testUser
} as Partial<UserCredential> as UserCredential

beforeEach(() => {
  sdk.listeners.length = 0
  vi.useFakeTimers()
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
