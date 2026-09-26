import type { FakeWebSessionState } from '@comfyorg/account-core/testing'
import {
  createFakeWebSessionEndpoint,
  fakeWebSessionUser
} from '@comfyorg/account-core/testing'
import { createMemoryHistory } from 'vue-router'

const h = vi.hoisted(() => ({ initializeApp: vi.fn() }))

vi.mock<unknown>(import('firebase/app'), () => ({
  getApps: () => [],
  initializeApp: (_options: unknown, name: string) => {
    h.initializeApp(name)
    return { name }
  }
}))

vi.mock<unknown>(import('firebase/auth'), () => ({
  GoogleAuthProvider: class {
    addScope() {}
    setCustomParameters() {}
  },
  GithubAuthProvider: class {},
  browserPopupRedirectResolver: {},
  getAuth: () => ({ currentUser: null }),
  initializeAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    queueMicrotask(() => callback(null))
    return () => undefined
  },
  onIdTokenChanged: () => () => undefined,
  signInWithPopup: async () => ({
    user: { uid: 'user-1', getIdToken: async () => 'proof-user-1' }
  })
}))

vi.mock(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org',
  STRIPE_PUBLISHABLE_KEY: undefined
}))

const CHECKOUT =
  '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator_monthly&workspace=ws-team'

const FIREBASE_CONFIG = {
  apiKey: 'api-key',
  authDomain: 'cloud.firebaseapp.com',
  projectId: 'cloud',
  appId: '1:1:web:1'
}

function stubCloud(state: FakeWebSessionState) {
  const endpoint = createFakeWebSessionEndpoint({ state })
  const sent: { path: string; workspace: string | null }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init = {}) => {
      const { pathname } = new URL(String(input))
      const workspace = new Headers(init.headers).get('X-Comfy-Workspace-ID')
      sent.push({ path: pathname, workspace })
      if (pathname === '/api/features') {
        return new Response(
          JSON.stringify(
            init.credentials === 'include'
              ? { unified_web_session: true }
              : { web_session_probe: true, firebase_config: FIREBASE_CONFIG }
          )
        )
      }
      if (pathname === '/api/workspaces/current') {
        return new Response(
          JSON.stringify({
            auth_method: 'session',
            id: 'ws-team',
            name: 'Team',
            type: 'team'
          })
        )
      }
      return endpoint.fetch(input, init)
    })
  )
  return sent
}

/** The router plus the sign-in page's controller, as `SignInView` wires them. */
async function arriveAt(path: string) {
  vi.resetModules()
  const [{ createBillingRouter }, { useSignInController }, auth, returnTo] =
    await Promise.all([
      import('@/router'),
      import('@/auth/useSignInController'),
      import('@/session/billingWebAuth'),
      import('@/auth/returnTo')
    ])
  const router = createBillingRouter(createMemoryHistory())
  await router.push(path)
  const signInPage = useSignInController(() => {
    void router.replace(
      returnTo.safeReturnTo(router.currentRoute.value.query.returnTo)
    )
  }, auth.billingWebSignInPort())
  return { router, signInPage }
}

beforeEach(() => {
  sessionStorage.clear()
  h.initializeApp.mockClear()
})

describe('billing-web with unified_web_session on', () => {
  it('leaves for checkout on a Cloud session with no sign-in and no Firebase (SS1)', async () => {
    const sent = stubCloud({ kind: 'live', user: fakeWebSessionUser() })

    const { router, signInPage } = await arriveAt(CHECKOUT)

    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(CHECKOUT)
    )
    expect(signInPage.leaving.value).toBe(true)
    expect(h.initializeApp).not.toHaveBeenCalled()
    expect(sent.map(({ path }) => path)).not.toContain('/api/auth/token')
    expect(sent).toContainEqual({
      path: '/api/workspaces/current',
      workspace: 'ws-team'
    })
  })

  it('keeps every entry parameter through a genuine sign-in (SO1)', async () => {
    stubCloud({ kind: 'dead', code: 'no_session' })

    const { router, signInPage } = await arriveAt(CHECKOUT)
    expect(router.currentRoute.value.query.returnTo).toBe(CHECKOUT)
    await vi.waitFor(() => expect(signInPage.available.value).toBe(true))
    expect(h.initializeApp).toHaveBeenCalledOnce()

    await signInPage.signInWith('google')

    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(CHECKOUT)
    )
  })
})
