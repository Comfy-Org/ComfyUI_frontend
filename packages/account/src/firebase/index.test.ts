import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(() => new Promise(() => {})),
  createUserWithEmailAndPassword: vi.fn(() => new Promise(() => {})),
  sendPasswordResetEmail: vi.fn(() => new Promise(() => {})),
  signInWithPopup: vi.fn(() => new Promise(() => {})),
  signOut: vi.fn(async () => {})
}))

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
  onAuthStateChanged: vi.fn(() => () => undefined),
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

beforeEach(() => {
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
