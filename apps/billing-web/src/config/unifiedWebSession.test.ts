/**
 * Pins every request this origin sends while loading its config, through the
 * real account-core chain: with the probe off the reader adds nothing to
 * main's single anonymous `/api/features` read.
 */
vi.mock<unknown>(import('firebase/app'), () => ({
  getApps: () => [],
  initializeApp: (_options: unknown, name: string) => ({ name })
}))

vi.mock<unknown>(import('firebase/auth'), () => ({
  GoogleAuthProvider: class {},
  GithubAuthProvider: class {},
  browserPopupRedirectResolver: {},
  getAuth: () => ({ currentUser: null }),
  initializeAuth: () => ({ currentUser: null }),
  onAuthStateChanged: () => () => undefined,
  onIdTokenChanged: () => () => undefined
}))

vi.mock(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org',
  STRIPE_PUBLISHABLE_KEY: undefined
}))

const FEATURES_URL = 'https://testcloud.comfy.org/api/features'

const ANONYMOUS_DOCUMENT = {
  firebase_config: {
    apiKey: 'api-key',
    authDomain: 'cloud.firebaseapp.com',
    projectId: 'cloud',
    appId: '1:1:web:1'
  },
  stripe_publishable_key: 'pk_test_1'
}

interface SentRequest {
  readonly url: string
  readonly credentials?: RequestCredentials
  readonly cache?: RequestCache
  readonly headers?: HeadersInit
}

const MAIN_ANONYMOUS_READ: SentRequest = { url: FEATURES_URL }

const CREDENTIALED_READ: SentRequest = {
  url: FEATURES_URL,
  credentials: 'include',
  cache: 'no-store',
  headers: {
    'X-Comfy-Client': expect.stringMatching(/^@comfyorg\/account-core\//)
  }
}

function recordingFetch(
  anonymous: Record<string, unknown>,
  perUser: Record<string, unknown>
) {
  const sent: SentRequest[] = []
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const { credentials, cache, headers } = init ?? {}
    sent.push({ url: String(input), credentials, cache, headers })
    const body = credentials === 'include' ? perUser : anonymous
    return new Response(JSON.stringify(body))
  })
  return { sent, fetchImpl }
}

async function loadMainConfig() {
  vi.resetModules()
  const { resolveBillingWebIdentity } = await import('@/config/firebase')
  const { awaitBillingWebStripeKey } = await import('@/config/stripeKey')
  const { readBillingWebUnifiedWebSession } =
    await import('@/config/unifiedWebSession')
  return {
    main: () =>
      Promise.all([resolveBillingWebIdentity(), awaitBillingWebStripeKey()]),
    readBillingWebUnifiedWebSession
  }
}

function sentShape(sent: readonly SentRequest[]) {
  return sent.map((request) =>
    Object.fromEntries(
      Object.entries(request).filter(([, value]) => value !== undefined)
    )
  )
}

describe('billing-web unified_web_session reader', () => {
  it('main sends one anonymous /api/features read', async () => {
    const { sent, fetchImpl } = recordingFetch(ANONYMOUS_DOCUMENT, {})
    vi.stubGlobal('fetch', fetchImpl)
    const { main } = await loadMainConfig()

    await main()

    expect(sentShape(sent)).toEqual([MAIN_ANONYMOUS_READ])
  })

  it.for([
    {
      name: 'probe absent',
      probe: {},
      perUser: { unified_web_session: true },
      requests: [MAIN_ANONYMOUS_READ],
      enabled: false
    },
    {
      name: 'probe false',
      probe: { web_session_probe: false },
      perUser: { unified_web_session: true },
      requests: [MAIN_ANONYMOUS_READ],
      enabled: false
    },
    {
      name: 'probe "true"',
      probe: { web_session_probe: 'true' },
      perUser: { unified_web_session: true },
      requests: [MAIN_ANONYMOUS_READ],
      enabled: false
    },
    {
      name: 'probe true, flag false',
      probe: { web_session_probe: true },
      perUser: { unified_web_session: false },
      requests: [MAIN_ANONYMOUS_READ, CREDENTIALED_READ],
      enabled: false
    },
    {
      name: 'probe true, flag true',
      probe: { web_session_probe: true },
      perUser: { unified_web_session: true },
      requests: [MAIN_ANONYMOUS_READ, CREDENTIALED_READ],
      enabled: true
    }
  ])(
    '$name: sends exactly the expected requests, once per page load',
    async ({ probe, perUser, requests, enabled }) => {
      const { sent, fetchImpl } = recordingFetch(
        { ...ANONYMOUS_DOCUMENT, ...probe },
        perUser
      )
      vi.stubGlobal('fetch', fetchImpl)
      const { main, readBillingWebUnifiedWebSession } = await loadMainConfig()

      const [, first, second] = await Promise.all([
        main(),
        readBillingWebUnifiedWebSession(),
        readBillingWebUnifiedWebSession()
      ])

      expect([first, second]).toEqual([enabled, enabled])
      expect(sentShape(sent)).toEqual(requests)
    }
  )

  it('is off, and never throws, when the anonymous read fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    const { readBillingWebUnifiedWebSession } = await loadMainConfig()

    await expect(readBillingWebUnifiedWebSession()).resolves.toBe(false)
  })
})
