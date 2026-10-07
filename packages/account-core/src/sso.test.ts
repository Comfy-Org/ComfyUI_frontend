import { describe, expect, it, vi } from 'vitest'

import type { SsoDiscovery } from './sso'
import {
  discoverSso,
  readSsoError,
  ssoRequiredOrganizationId,
  ssoStartUrl
} from './sso'

const ORIGIN = 'https://cloud.comfy.org'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('discoverSso', () => {
  it.for<{ name: string; response: () => Response; expected: SsoDiscovery }>([
    {
      name: 'an SSO domain names its organization',
      response: () => json(200, { sso: true, organization_name: 'Acme' }),
      expected: { kind: 'sso', organizationName: 'Acme' }
    },
    {
      name: 'an SSO domain without a name is still SSO',
      response: () => json(200, { sso: true }),
      expected: { kind: 'sso' }
    },
    {
      name: 'a domain without SSO',
      response: () => json(200, { sso: false }),
      expected: { kind: 'not-sso' }
    },
    {
      name: 'a 400 INVALID_EMAIL',
      response: () =>
        json(400, { code: 'INVALID_EMAIL', message: 'An email is required' }),
      expected: { kind: 'invalid-email' }
    },
    {
      name: 'a 400 with another code',
      response: () => json(400, { code: 'BAD_REQUEST', message: 'nope' }),
      expected: { kind: 'unavailable' }
    },
    {
      name: 'a 500',
      response: () => json(500, { code: 'INTERNAL_ERROR', message: 'down' }),
      expected: { kind: 'unavailable' }
    },
    {
      name: 'a 404 from an ingest without the route',
      response: () => new Response('not found', { status: 404 }),
      expected: { kind: 'unavailable' }
    },
    {
      name: 'a 200 whose body is not the contract',
      response: () => json(200, { sso: 'yes' }),
      expected: { kind: 'unavailable' }
    },
    {
      name: 'a 200 whose body is not JSON',
      response: () => new Response('<html>', { status: 200 }),
      expected: { kind: 'unavailable' }
    }
  ])('reads $name', async ({ response, expected }) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response())

    expect(await discoverSso('a@acme.com', { fetchImpl })).toEqual(expected)
  })

  it('is unavailable when the request fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })

    expect(await discoverSso('a@acme.com', { fetchImpl })).toEqual({
      kind: 'unavailable'
    })
  })

  it('is unavailable when ingest does not answer in time', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(init.signal?.reason)
            )
          })
      )
      const pending = discoverSso('a@acme.com', { fetchImpl, timeoutMs: 100 })

      await vi.advanceTimersByTimeAsync(100)

      expect(await pending).toEqual({ kind: 'unavailable' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('posts the trimmed email to the discover route', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(200, { sso: false }))

    await discoverSso('  a@acme.com ', {
      fetchImpl,
      baseUrl: 'https://ingest.example'
    })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ingest.example/api/auth/sso/discover')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'a@acme.com' })
  })

  it.for([
    ['an empty email', '   '],
    ['an email past the 320-char contract limit', `${'a'.repeat(320)}@x.co`]
  ])('rejects %s without asking ingest', async ([, email]) => {
    const fetchImpl = vi.fn<typeof fetch>()

    expect(await discoverSso(email, { fetchImpl })).toEqual({
      kind: 'invalid-email'
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('ssoStartUrl', () => {
  const startParams = (returnTo: string) =>
    new URL(ssoStartUrl({ email: ' a@acme.com ', returnTo, origin: ORIGIN }))
      .searchParams

  it('points at the start route with the email and return path', () => {
    const url = new URL(
      ssoStartUrl({
        email: ' a@acme.com ',
        returnTo: '/cloud/user-check?x=1',
        origin: ORIGIN
      })
    )

    expect(url.origin + url.pathname).toBe(`${ORIGIN}/api/auth/sso/start`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      email: 'a@acme.com',
      return_to: '/cloud/user-check?x=1'
    })
  })

  it.for([
    ['an absolute off-origin URL', 'https://evil.example/x'],
    ['a protocol-relative URL', '//evil.example/x'],
    ['a backslash-prefixed URL', '/\\evil.example'],
    ['a tab hiding a protocol-relative URL', '/\t//evil.example'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'cloud/user-check'],
    ['the API root', '/api'],
    ['an API route', '/api/auth/sso/start?return_to=/x'],
    ['an API route behind a dot segment', '/x/../API/userdata'],
    ['an empty path', '']
  ])('sends %s back to the root', ([, returnTo]) => {
    expect(startParams(returnTo).get('return_to')).toBe('/')
  })

  it('keeps an app path that only starts with "api"', () => {
    expect(startParams('/apiary').get('return_to')).toBe('/apiary')
  })

  it.for<{
    name: string
    email?: string
    expected: Record<string, string>
  }>([
    {
      name: 'with the email as a hint',
      email: 'alice@comfy.org',
      expected: {
        email: 'alice@comfy.org',
        organization: 'org_meta',
        return_to: '/x'
      }
    },
    {
      name: 'without an email',
      expected: { organization: 'org_meta', return_to: '/x' }
    }
  ])('targets a named organization $name', ({ email, expected }) => {
    const url = new URL(
      ssoStartUrl({
        organizationId: 'org_meta',
        email,
        returnTo: '/x',
        origin: ORIGIN
      })
    )

    expect(Object.fromEntries(url.searchParams)).toEqual(expected)
  })
})

describe('ssoRequiredOrganizationId', () => {
  const refusal = { code: 'sso_required', message: 'x' }

  it.for<[string, unknown, string | undefined]>([
    [
      'a named organization',
      { ...refusal, organization_id: 'org_meta' },
      'org_meta'
    ],
    ['a refusal without one', refusal, undefined],
    ['an empty organization', { ...refusal, organization_id: '' }, undefined],
    [
      'a non-string organization',
      { ...refusal, organization_id: 7 },
      undefined
    ],
    ['no body', undefined, undefined]
  ])('reads %s', ([, body, expected]) => {
    expect(ssoRequiredOrganizationId(body)).toBe(expected)
  })
})

describe('readSsoError', () => {
  it.for([
    'INTERNAL_ERROR',
    'RATE_LIMITED',
    'SESSION_CREATION_FAILED',
    'SSO_ACCOUNT_CONFLICT',
    'SSO_ACCOUNT_DELETED',
    'SSO_CONFIRM_EXPIRED',
    'SSO_EXCHANGE_FAILED',
    'SSO_IDP_ERROR',
    'SSO_INVALID_STATE',
    'SSO_LINK_CHECK_FAILED',
    'SSO_NOT_CONFIGURED',
    'SSO_ORG_DISABLED',
    'SSO_ORG_MISMATCH',
    'SSO_ORG_NOT_ATTACHED',
    'SSO_SIGN_IN_FAILED',
    'SSO_UNAVAILABLE',
    'SSO_USER_SUSPENDED'
  ])('keeps the ingest code %s', (code) => {
    expect(readSsoError(code)).toBe(code)
  })

  it.for([
    ['a code this build predates', 'SSO_SOMETHING_NEW'],
    ['a lowercase spelling', 'rate_limited']
  ])('reads %s as a generic sign-in failure', ([, value]) => {
    expect(readSsoError(value)).toBe('SSO_SIGN_IN_FAILED')
  })

  it('reads the first of a repeated query value', () => {
    expect(readSsoError(['SSO_ORG_DISABLED', 'RATE_LIMITED'])).toBe(
      'SSO_ORG_DISABLED'
    )
  })

  it.for([
    ['absent', undefined],
    ['null', null],
    ['empty', ''],
    ['not a string', 42],
    ['an empty repeated value', []],
    ['an object', {}]
  ])('has no error when the value is %s', ([, value]) => {
    expect(readSsoError(value)).toBeUndefined()
  })
})
