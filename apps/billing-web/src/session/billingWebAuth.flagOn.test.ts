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
  BILLING_WEB_ENV: 'test' as const,
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

interface CloudOverrides {
  readonly workspace?: () => Response
  readonly createSession?: () => Response
  readonly credentialedFeaturesDelayMs?: number
}

async function answerFeatures(
  init: RequestInit,
  credentialedDelayMs = 0
): Promise<Response> {
  const credentialed = init.credentials === 'include'
  if (credentialed && credentialedDelayMs > 0)
    await new Promise((resolve) => setTimeout(resolve, credentialedDelayMs))
  return new Response(
    JSON.stringify(
      credentialed
        ? { unified_web_session: true, billing_web_checkout_ui: 'full_page' }
        : { web_session_probe: true, firebase_config: FIREBASE_CONFIG }
    )
  )
}

function stubCloud(state: FakeWebSessionState, overrides: CloudOverrides = {}) {
  const endpoint = createFakeWebSessionEndpoint({ state })
  const sent: { path: string; workspace: string | null }[] = []
  vi.mocked(fetch).mockImplementation(async (input, init = {}) => {
    const { pathname } = new URL(String(input))
    const workspace = new Headers(init.headers).get('X-Comfy-Workspace-ID')
    sent.push({ path: pathname, workspace })
    if (pathname === '/api/features')
      return answerFeatures(init, overrides.credentialedFeaturesDelayMs)
    if (pathname === '/api/workspaces/current' && overrides.workspace) {
      return overrides.workspace()
    }
    if (
      pathname === '/api/auth/session' &&
      init.method === 'POST' &&
      overrides.createSession
    ) {
      return overrides.createSession()
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
  return sent
}

/** The router plus the sign-in page's controller, as `SignInView` wires them. */
async function arriveAt(path: string) {
  vi.resetModules()
  const [
    { createBillingRouter },
    { useSignInController },
    auth,
    returnTo,
    { billingWebTelemetry }
  ] = await Promise.all([
    import('@/router'),
    import('@/auth/useSignInController'),
    import('@/session/billingWebAuth'),
    import('@/auth/returnTo'),
    import('@/telemetry/billingWebTelemetry')
  ])
  const track = vi
    .spyOn(billingWebTelemetry, 'trackBillingEvent')
    .mockImplementation(() => undefined)
  const events = () => track.mock.calls.map(([event]) => event)
  const router = createBillingRouter(createMemoryHistory())
  await router.push(path)
  const signInPage = useSignInController(() => {
    void router.replace(
      returnTo.safeReturnTo(router.currentRoute.value.query.returnTo)
    )
  }, auth.billingWebSignInPort())
  return { router, signInPage, events }
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

  it("waits for a slow Cloud session answer instead of falling back to this origin's own sign-in", async () => {
    const sent = stubCloud(
      { kind: 'live', user: fakeWebSessionUser() },
      { credentialedFeaturesDelayMs: 1200 }
    )

    const { router, signInPage } = await arriveAt(CHECKOUT)

    await vi.waitFor(
      () => expect(router.currentRoute.value.fullPath).toBe(CHECKOUT),
      { timeout: 4000 }
    )
    expect(signInPage.leaving.value).toBe(true)
    expect(h.initializeApp).not.toHaveBeenCalled()
    expect(sent.map(({ path }) => path)).not.toContain('/api/auth/token')
  }, 8000)

  it("renders the checkout UI the Cloud session's account is flagged for", async () => {
    stubCloud({ kind: 'live', user: fakeWebSessionUser() })
    const { router } = await arriveAt(CHECKOUT)
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(CHECKOUT)
    )
    const { awaitCheckoutUiVariant } = await import('@/config/checkoutUi')

    await expect(awaitCheckoutUiVariant()).resolves.toBe('full_page')
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

describe('billing-web with unified_web_session on, as a funnel', () => {
  const RECEIVED = {
    operation: 'web_entry',
    stage: 'received',
    outcome: 'pending',
    intent: 'checkout',
    product: 'comfyui',
    has_plan: true
  }

  it('reports a Cloud session as established, with no sign-in screen', async () => {
    stubCloud({ kind: 'live', user: fakeWebSessionUser() })

    const { router, signInPage, events } = await arriveAt(CHECKOUT)

    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(CHECKOUT)
    )
    expect(signInPage.leaving.value).toBe(true)
    expect(events()).toEqual([
      RECEIVED,
      {
        operation: 'web_session',
        stage: 'established',
        outcome: 'pending',
        origin: 'restored',
        mode: 'web-session'
      }
    ])
  })

  it('reports a second sign-in as required, then established interactively', async () => {
    stubCloud({ kind: 'dead', code: 'no_session' })

    const { router, signInPage, events } = await arriveAt(CHECKOUT)
    await vi.waitFor(() => expect(signInPage.available.value).toBe(true))
    await signInPage.signInWith('google')

    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(CHECKOUT)
    )
    expect(events()).toEqual([
      RECEIVED,
      {
        operation: 'web_session',
        stage: 'signin_required',
        outcome: 'pending',
        reason: 'no_session'
      },
      {
        operation: 'web_session',
        stage: 'established',
        outcome: 'pending',
        origin: 'interactive',
        mode: 'web-session'
      }
    ])
  })

  it('reports a refused workspace as sign-in required and the session as failed with its code', async () => {
    stubCloud(
      { kind: 'live', user: fakeWebSessionUser() },
      {
        workspace: () =>
          new Response(
            JSON.stringify({
              code: 'workspace_access_denied',
              message: 'denied'
            }),
            { status: 403 }
          )
      }
    )

    const { events } = await arriveAt(CHECKOUT)

    await vi.waitFor(() => expect(events()).toHaveLength(3))
    expect(events()).toEqual([
      RECEIVED,
      {
        operation: 'web_session',
        stage: 'signin_required',
        outcome: 'pending',
        reason: 'refused'
      },
      {
        operation: 'web_session',
        stage: 'failed',
        outcome: 'pending',
        error_code: 'ACCESS_DENIED'
      }
    ])
  })

  it.for([
    { name: 'an outage', status: 503, code: 'TOKEN_EXCHANGE_FAILED' },
    {
      name: 'a refused credential',
      status: 401,
      code: 'INVALID_FIREBASE_TOKEN'
    }
  ])(
    'reports the code of a shared session $name refuses to create',
    async ({ status, code }) => {
      stubCloud(
        { kind: 'dead', code: 'no_session' },
        { createSession: () => new Response('{}', { status }) }
      )

      const { signInPage, events } = await arriveAt(CHECKOUT)
      await vi.waitFor(() => expect(signInPage.available.value).toBe(true))
      await signInPage.signInWith('google')

      await vi.waitFor(() => expect(events()).toHaveLength(3))
      expect(events()).toEqual([
        RECEIVED,
        {
          operation: 'web_session',
          stage: 'signin_required',
          outcome: 'pending',
          reason: 'no_session'
        },
        {
          operation: 'web_session',
          stage: 'failed',
          outcome: 'pending',
          error_code: code
        }
      ])
    }
  )
})
