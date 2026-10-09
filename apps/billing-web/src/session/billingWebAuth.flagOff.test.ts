/**
 * With `unified_web_session` off, the whole sign-in-to-billing path sends
 * exactly main's requests: the Firebase config read, the token mint for the
 * restored sign-in, and the billing call on that token. The baseline is main's
 * own composition, run without the mode decision in front of it.
 */
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'

import type { BillingTelemetryEvent } from '@comfyorg/account-core/billing'

import type * as ControllerModule from '@/auth/useSignInController'
import type { SignInPort } from '@/auth/useSignInController'
import type * as AuthModule from '@/session/billingWebAuth'
import type * as ClientModule from '@/session/billingWebClient'
import type * as SessionModule from '@/session/billingWebSession'

const h = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  listeners: [] as Array<(user: null) => void>
}))

vi.mock<unknown>(import('firebase/app'), () => ({
  getApps: () => [],
  initializeApp: (_options: unknown, name: string) => {
    h.initializeApp(name)
    return { name }
  }
}))

vi.mock<unknown>(import('firebase/auth'), () => {
  const user = { uid: 'uid-1', getIdToken: async () => 'id-token' }
  const restore = (
    _auth: unknown,
    callback: (restored: typeof user | null) => void
  ) => {
    h.listeners.push(callback)
    queueMicrotask(() => callback(user))
    return () => undefined
  }
  return {
    GoogleAuthProvider: class {},
    GithubAuthProvider: class {},
    browserPopupRedirectResolver: {},
    getAuth: () => ({ currentUser: user }),
    initializeAuth: () => ({ currentUser: user }),
    onAuthStateChanged: restore,
    onIdTokenChanged: restore
  }
})

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org',
  STRIPE_PUBLISHABLE_KEY: undefined
}))

const CLOUD = 'https://testcloud.comfy.org'

const FIREBASE_CONFIG = {
  apiKey: 'api-key',
  authDomain: 'cloud.firebaseapp.com',
  projectId: 'cloud',
  appId: '1:1:web:1'
}

const MINTED = {
  token: 'jwt-1',
  permissions: ['workspace:read'],
  expires_at: new Date(Date.now() + 90 * 60_000).toISOString(),
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner'
}

interface SentRequest {
  readonly method: string
  readonly url: string
  readonly credentials?: RequestCredentials
  readonly headers: readonly string[]
  readonly authorization?: string
  readonly body?: unknown
}

function recordingFetch(
  anonymous: Record<string, unknown>,
  perUser: Record<string, unknown>
) {
  const sent: SentRequest[] = []
  const fetchImpl = vi.fn<typeof fetch>(async (input, init = {}) => {
    const url = String(input)
    sent.push({
      method: init.method ?? 'GET',
      url,
      credentials: init.credentials,
      headers: [...new Headers(init.headers).keys()]
        .map((name) => name.toLowerCase())
        .sort(),
      authorization:
        new Headers(init.headers).get('Authorization') ?? undefined,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    })
    const body = url.endsWith('/api/features')
      ? init.credentials === 'include'
        ? perUser
        : anonymous
      : url.endsWith('/api/auth/token')
        ? MINTED
        : {}
    return new Response(JSON.stringify(body))
  })
  return { sent, fetchImpl }
}

async function signInThenCallBilling(
  run: (modules: {
    readonly auth: typeof AuthModule
    readonly session: typeof SessionModule
    readonly client: typeof ClientModule
    readonly signIn: (port?: SignInPort) => Promise<void>
    readonly useSignInController: typeof ControllerModule.useSignInController
    readonly events: () => BillingTelemetryEvent[]
  }) => Promise<void>
) {
  vi.resetModules()
  const [
    auth,
    session,
    client,
    { useSignInController },
    { billingWebTelemetry }
  ] = await Promise.all([
    import('@/session/billingWebAuth'),
    import('@/session/billingWebSession'),
    import('@/session/billingWebClient'),
    import('@/auth/useSignInController'),
    import('@/telemetry/billingWebTelemetry')
  ])
  const track = vi
    .spyOn(billingWebTelemetry, 'trackBillingEvent')
    .mockImplementation(() => undefined)
  const events = () => track.mock.calls.map(([event]) => event)
  const signIn = (port?: SignInPort) =>
    new Promise<void>((resolve) => {
      useSignInController(resolve, port)
    })
  await run({ auth, session, client, signIn, useSignInController, events })
}

async function mainRequests(): Promise<SentRequest[]> {
  const { sent, fetchImpl } = recordingFetch(
    { firebase_config: FIREBASE_CONFIG },
    {}
  )
  vi.stubGlobal('fetch', fetchImpl)
  await signInThenCallBilling(async ({ session, client, signIn }) => {
    await signIn()
    await client
      .createBillingWebClient(session.billingWebSessionClient())
      .status.read()
  })
  return sent
}

const CREDENTIALED_FEATURES_READ: SentRequest = {
  method: 'GET',
  url: `${CLOUD}/api/features`,
  credentials: 'include',
  headers: ['x-comfy-client']
}

const TOKEN_HEADERS = ['authorization', 'content-type']

const MAIN_GOLDEN: readonly SentRequest[] = [
  { method: 'GET', url: `${CLOUD}/api/features`, headers: [] },
  {
    method: 'POST',
    url: `${CLOUD}/api/auth/token`,
    headers: TOKEN_HEADERS,
    authorization: 'Bearer id-token',
    body: {}
  },
  {
    method: 'POST',
    url: `${CLOUD}/api/auth/token`,
    headers: TOKEN_HEADERS,
    authorization: 'Bearer id-token',
    body: { workspace_id: 'ws-1' }
  },
  {
    method: 'GET',
    url: `${CLOUD}/api/billing/status`,
    headers: TOKEN_HEADERS,
    authorization: 'Bearer jwt-1'
  }
]

beforeEach(() => {
  sessionStorage.clear()
  h.initializeApp.mockClear()
  h.listeners.length = 0
})

describe('billing-web with unified_web_session off', () => {
  it.for([
    { name: 'probe absent', probe: {}, perUser: {}, extra: [] },
    {
      name: 'probe false',
      probe: { web_session_probe: false },
      perUser: { unified_web_session: true },
      extra: []
    },
    {
      name: 'probe "true"',
      probe: { web_session_probe: 'true' },
      perUser: { unified_web_session: true },
      extra: []
    },
    {
      name: 'probe true, flag false',
      probe: { web_session_probe: true },
      perUser: { unified_web_session: false },
      extra: [CREDENTIALED_FEATURES_READ]
    },
    {
      name: 'probe true, flag "true"',
      probe: { web_session_probe: true },
      perUser: { unified_web_session: 'true' },
      extra: [CREDENTIALED_FEATURES_READ]
    }
  ])(
    '$name: config read, sign-in and a billing call send main’s requests',
    async ({ probe, perUser, extra }) => {
      const main = await mainRequests()
      const { sent, fetchImpl } = recordingFetch(
        { firebase_config: FIREBASE_CONFIG, ...probe },
        perUser
      )
      vi.stubGlobal('fetch', fetchImpl)

      await signInThenCallBilling(async ({ auth, signIn }) => {
        await signIn(auth.billingWebSignInPort())
        await auth.createModeBillingClient().status.read()
      })

      expect(new Set(main.map(({ url }) => url))).toEqual(
        new Set([
          `${CLOUD}/api/features`,
          `${CLOUD}/api/auth/token`,
          `${CLOUD}/api/billing/status`
        ])
      )
      const [features, ...rest] = main
      expect(sent).toEqual([features, ...extra, ...rest])
      expect(main).toEqual(MAIN_GOLDEN)
    }
  )
})

describe('billing-web with unified_web_session off, after sign-in', () => {
  async function signedInRequests(
    run: (modules: {
      readonly auth: typeof AuthModule
      readonly requestsSinceSignIn: () => SentRequest[]
    }) => Promise<void>
  ) {
    const { sent, fetchImpl } = recordingFetch(
      { firebase_config: FIREBASE_CONFIG },
      {}
    )
    vi.stubGlobal('fetch', fetchImpl)
    await signInThenCallBilling(async ({ auth, signIn }) => {
      await signIn(auth.billingWebSignInPort())
      const signedInCount = sent.length
      await run({
        auth,
        requestsSinceSignIn: () => sent.slice(signedInCount)
      })
    })
  }

  it('an entry link naming another workspace re-mints once, for that workspace, however often it repeats', async () => {
    await signedInRequests(async ({ auth, requestsSinceSignIn }) => {
      auth.onBillingWebEntryWorkspace('ws-2')
      auth.onBillingWebEntryWorkspace('ws-2')

      await vi.waitFor(() => expect(requestsSinceSignIn()).not.toEqual([]))
      expect(requestsSinceSignIn()).toEqual([
        {
          method: 'POST',
          url: `${CLOUD}/api/auth/token`,
          headers: TOKEN_HEADERS,
          authorization: 'Bearer id-token',
          body: { workspace_id: 'ws-2' }
        }
      ])
    })
  })

  it('signing out drops the credential and sends nothing', async () => {
    await signedInRequests(async ({ auth, requestsSinceSignIn }) => {
      expect(
        sessionStorage.getItem('comfy.billing-web.session.v1')
      ).not.toBeNull()
      h.listeners.forEach((listener) => listener(null))

      await vi.waitFor(() =>
        expect(auth.billingWebLivePhase.value).toBe('signed-out')
      )
      expect(requestsSinceSignIn()).toEqual([])
      expect(sessionStorage.getItem('comfy.billing-web.session.v1')).toBeNull()
    })
  })
})

describe('billing-web with unified_web_session off, as a funnel', () => {
  it('reports a restored sign-in as established on the session client', async () => {
    const { fetchImpl } = recordingFetch(
      { firebase_config: FIREBASE_CONFIG },
      {}
    )
    vi.stubGlobal('fetch', fetchImpl)

    await signInThenCallBilling(async ({ auth, signIn, events }) => {
      await signIn(auth.billingWebSignInPort())

      expect(events()).toEqual([
        {
          operation: 'web_session',
          stage: 'established',
          outcome: 'pending',
          origin: 'restored',
          mode: 'session-client'
        }
      ])
    })
  })

  it('reports a refused mint as sign-in required and failed with the refusal’s code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) =>
        String(input).endsWith('/api/features')
          ? new Response(JSON.stringify({ firebase_config: FIREBASE_CONFIG }))
          : new Response('{}', { status: 403 })
      )
    )

    await signInThenCallBilling(
      async ({ auth, useSignInController, events }) => {
        useSignInController(() => undefined, auth.billingWebSignInPort())

        await vi.waitFor(() => expect(events()).toHaveLength(2))
        expect(events()).toEqual([
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
      }
    )
  })
})

const ENTRY = '/v1/subscription?product=comfyui&return_to=comfyui_workspace'
const UNAVAILABLE = 'Sign-in is unavailable right now.'

async function renderApp() {
  const [{ default: App }, { createBillingI18n }, { createBillingRouter }] =
    await Promise.all([
      import('@/App.vue'),
      import('@/i18n'),
      import('@/router')
    ])
  const router = createBillingRouter(createMemoryHistory())
  await router.push(ENTRY)
  render(App, { global: { plugins: [createBillingI18n(), router] } })
  return router
}

describe('billing-web first render with unified_web_session undecided', () => {
  it('routes and shows main’s "sign-in unavailable" notice without waiting for the flag', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {}))
    )
    vi.resetModules()

    const router = await renderApp()

    expect(router.currentRoute.value.path).toBe('/sign-in')
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    expect(h.initializeApp).not.toHaveBeenCalled()
  })

  it('takes the session-client path only once the flag read times out, and never swaps', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { sent, fetchImpl } = recordingFetch(
      { firebase_config: FIREBASE_CONFIG, web_session_probe: true },
      {}
    )
    let answerFlag: (response: Response) => void = () => undefined
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) =>
        init?.credentials === 'include'
          ? new Promise<Response>((resolve, reject) => {
              answerFlag = resolve
              init.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError'))
              )
            })
          : fetchImpl(input, init)
      )
    )
    vi.resetModules()

    const router = await renderApp()
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(3999)
    expect(h.initializeApp).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => expect(h.initializeApp).toHaveBeenCalledOnce())
    answerFlag(new Response(JSON.stringify({ unified_web_session: true })))
    await vi.advanceTimersByTimeAsync(5000)
    await router.push(`${ENTRY}&plan=creator_monthly`)

    expect(sent.map(({ url }) => url)).not.toContain(
      `${CLOUD}/api/auth/session`
    )
    expect(h.initializeApp).toHaveBeenCalledOnce()
  })

  it('does not wait for the flag read when the probe is false', async () => {
    const { fetchImpl } = recordingFetch(
      { firebase_config: FIREBASE_CONFIG, web_session_probe: false },
      {}
    )
    vi.stubGlobal('fetch', fetchImpl)
    vi.resetModules()

    await renderApp()

    await vi.waitFor(() => expect(h.initializeApp).toHaveBeenCalledOnce(), {
      timeout: 400
    })
  })
})
