/**
 * Drives useSignInController through the real @comfyorg/account-core
 * resolution chain instead of mocking @/config/firebase, so a regression in
 * account-core's own caching shows up here the way it would in the app.
 */
import { respondToFetch } from '@comfyorg/test-utils/fetch'

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

const FEATURES_URL = 'https://testcloud.comfy.org/api/features'

const VALID_FIREBASE_CONFIG = {
  apiKey: 'api-key',
  authDomain: 'cloud.firebaseapp.com',
  projectId: 'cloud',
  appId: '1:1:web:1'
}

describe('useSignInController identity availability, real account-core resolution', () => {
  it('reaches a fresh /api/features request on retryAvailability after a failed startup resolution', async () => {
    respondToFetch(FEATURES_URL, () =>
      Response.json({ firebase_config: VALID_FIREBASE_CONFIG })
    )
    respondToFetch(FEATURES_URL, () => new Response('not json'), { times: 1 })

    const controller = useSignInController(() => undefined)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    // The startup fetch settling doesn't itself resolve `identity.value`:
    // let the rest of its promise chain (parsing, cache write) drain too.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.available.value).toBe(false)

    await controller.retryAvailability()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(controller.available.value).toBe(true)
    await controller.signInWith('google')
    expect(controller.errorMessage.value).toBe('')
  })
})
