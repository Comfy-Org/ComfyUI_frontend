/**
 * Drives useSignInController through the real @comfyorg/account-core
 * resolution chain instead of mocking @/config/firebase, so a regression in
 * account-core's own caching shows up here the way it would in the app.
 */
import { useSignInController } from '@/auth/useSignInController'

const sdk = vi.hoisted(() => ({
  resolvedAuth: { currentUser: null } as { currentUser: unknown }
}))

vi.mock<unknown>(import('firebase/app'), () => ({
  getApps: () => [],
  initializeApp: (_options: unknown, name: string) => ({ name })
}))

vi.mock<unknown>(import('firebase/auth'), () => ({
  GoogleAuthProvider: class {
    addScope(): void {}
    setCustomParameters(): void {}
  },
  GithubAuthProvider: class {
    addScope(): void {}
    setCustomParameters(): void {}
  },
  browserPopupRedirectResolver: {},
  getAuth: () => sdk.resolvedAuth,
  initializeAuth: () => sdk.resolvedAuth,
  onAuthStateChanged: () => () => undefined,
  onIdTokenChanged: () => () => undefined,
  signInWithPopup: async () => ({ user: { uid: 'uid-1' } })
}))

vi.mock<unknown>(import('@/session/billingWebSession'), async () => {
  const { computed, ref } = await import('vue')
  return {
    useBillingWebSession: () => ({
      user: ref(null),
      phase: computed(() => 'pending'),
      session: computed(() => undefined)
    }),
    billingWebSessionClient: () => ({
      ensureFresh: vi.fn(async () => ({ status: 'ok' as const }))
    })
  }
})

const VALID_FIREBASE_CONFIG = {
  apiKey: 'api-key',
  authDomain: 'cloud.firebaseapp.com',
  projectId: 'cloud',
  appId: '1:1:web:1'
}

describe('useSignInController identity availability, real account-core resolution', () => {
  it('reaches a fresh /api/features request on retryAvailability after a failed startup resolution', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ firebase_config: VALID_FIREBASE_CONFIG }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchImpl)

    const controller = useSignInController(() => undefined)
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1))
    // The startup fetch settling doesn't itself resolve `identity.value`:
    // let the rest of its promise chain (parsing, cache write) drain too.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.available.value).toBe(false)

    await controller.retryAvailability()

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(controller.available.value).toBe(true)
    await controller.signInWith('google')
    expect(controller.errorMessage.value).toBe('')
  })
})
