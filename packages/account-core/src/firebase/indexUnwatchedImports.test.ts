import { describe, expect, it, vi } from 'vitest'

/**
 * A host test mock of `firebase/auth` without the browser persistences, the
 * way billing-web's is: an identity that is not watched must still load.
 */
vi.mock<unknown>(import('firebase/app'), () => ({
  FirebaseError: class FirebaseError extends Error {},
  getApps: () => [],
  initializeApp: vi.fn(() => ({ name: 'host-app' }))
}))

vi.mock<unknown>(import('firebase/auth'), () => ({
  GoogleAuthProvider: class {},
  GithubAuthProvider: class {},
  browserPopupRedirectResolver: class BrowserPopupRedirectResolver {},
  getAuth: vi.fn(() => ({ currentUser: null })),
  initializeAuth: vi.fn(() => ({ currentUser: null }))
}))

describe('an identity that is not watched', () => {
  it('loads and resolves Auth without reading the persistences only a watched identity defaults to', async () => {
    const { createFirebaseIdentity } = await import('./index.js')

    const identity = createFirebaseIdentity({
      options: { apiKey: 'test' },
      persistence: [{ type: 'LOCAL' }] as never
    })

    expect(() => identity.initialize()).not.toThrow()
  })
})
