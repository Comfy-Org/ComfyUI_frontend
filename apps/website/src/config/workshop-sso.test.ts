import { describe, expect, it, vi } from 'vitest'

import { createSsoStartResolver } from './workshop-sso'

const CLOUD = 'https://cloud.example'
const FEATURES_URL = `${CLOUD}/api/features`
const DISCOVER_URL = `${CLOUD}/api/auth/sso/discover`

type Route = () => Response | Promise<Response>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

function cloud(routes: { features: Route; discover?: Route }) {
  return vi.fn<typeof fetch>(async (input) => {
    if (input === FEATURES_URL) return routes.features()
    if (input === DISCOVER_URL && routes.discover) return routes.discover()
    throw new TypeError(`unexpected request to ${String(input)}`)
  })
}

const requestedUrls = (fetchImpl: ReturnType<typeof cloud>) =>
  fetchImpl.mock.calls.map(([input]) => input)

const ssoOn = () => json({ sso_enabled: true })

describe('createSsoStartResolver', () => {
  it.for([
    { case: 'absent', features: () => json({}) },
    { case: 'false', features: () => json({ sso_enabled: false }) },
    { case: 'not a boolean', features: () => json({ sso_enabled: 'true' }) },
    { case: 'a failed read', features: () => json({}, 503) },
    {
      case: 'a network error',
      features: () => Promise.reject(new TypeError('offline'))
    }
  ])(
    'stays on Firebase without asking discover when sso_enabled is $case',
    async ({ features }) => {
      const fetchImpl = cloud({ features })
      const resolve = createSsoStartResolver({ cloudBaseUrl: CLOUD, fetchImpl })

      await expect(resolve('ada@acme.com')).resolves.toBeUndefined()
      expect(requestedUrls(fetchImpl)).toEqual([FEATURES_URL])
    }
  )

  it("sends an SSO domain to Cloud's SSO start, returning to the Cloud user check", async () => {
    const fetchImpl = cloud({
      features: ssoOn,
      discover: () => json({ sso: true, organization_name: 'Acme' })
    })
    const resolve = createSsoStartResolver({ cloudBaseUrl: CLOUD, fetchImpl })

    const start = await resolve(' ada@acme.com ')

    expect(start).toBeDefined()
    const url = new URL(start!)
    expect(url.origin + url.pathname).toBe(`${CLOUD}/api/auth/sso/start`)
    expect(url.searchParams.get('email')).toBe('ada@acme.com')
    expect(url.searchParams.get('return_to')).toBe('/cloud/user-check')
    const [, init] = fetchImpl.mock.calls[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ email: 'ada@acme.com' }))
  })

  it.for([
    { case: 'not an SSO domain', discover: () => json({ sso: false }) },
    {
      case: 'rejected as invalid',
      discover: () => json({ code: 'INVALID_EMAIL', message: 'bad' }, 400)
    },
    {
      case: 'down',
      discover: () => json({ code: 'INTERNAL_ERROR', message: 'x' }, 500)
    },
    {
      case: 'unreachable',
      discover: () => Promise.reject(new TypeError('blocked by CORS'))
    }
  ])('falls back to Firebase when discover is $case', async ({ discover }) => {
    const fetchImpl = cloud({ features: ssoOn, discover })
    const resolve = createSsoStartResolver({ cloudBaseUrl: CLOUD, fetchImpl })

    await expect(resolve('ada@acme.com')).resolves.toBeUndefined()
    expect(requestedUrls(fetchImpl)).toEqual([FEATURES_URL, DISCOVER_URL])
  })

  it('reads the flag once per page load, however many times the visitor submits', async () => {
    const fetchImpl = cloud({
      features: ssoOn,
      discover: () => json({ sso: false })
    })
    const resolve = createSsoStartResolver({ cloudBaseUrl: CLOUD, fetchImpl })

    await resolve('ada@example.com')
    await resolve('grace@example.com')

    expect(requestedUrls(fetchImpl)).toEqual([
      FEATURES_URL,
      DISCOVER_URL,
      DISCOVER_URL
    ])
  })

  it('answers a submit from the flag read warmed at page load, without a second read', async () => {
    const features = Promise.withResolvers<Response>()
    const fetchImpl = cloud({ features: () => features.promise })
    const resolve = createSsoStartResolver({ cloudBaseUrl: CLOUD, fetchImpl })

    resolve.warm()
    expect(requestedUrls(fetchImpl)).toEqual([FEATURES_URL])
    features.resolve(json({ sso_enabled: false }))

    await expect(resolve('ada@acme.com')).resolves.toBeUndefined()
    expect(requestedUrls(fetchImpl)).toEqual([FEATURES_URL])
  })
})
