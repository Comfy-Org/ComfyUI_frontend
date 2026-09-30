import { describe, expect, it, vi } from 'vitest'

import {
  discoverSso,
  isSsoRequiredRefusal,
  readSsoError,
  safeSsoReturnTo,
  ssoStartUrl
} from './sso'

const ORIGIN = 'https://cloud.comfy.org'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('discoverSso', () => {
  it('posts the trimmed email to the discover endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { sso: false })
    )

    await discoverSso('  a@corp.example ', { fetchImpl, baseUrl: ORIGIN })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${ORIGIN}/api/auth/sso/discover`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@corp.example' })
      })
    )
  })

  it.for([
    [
      'an SSO domain with its org name',
      jsonResponse(200, { sso: true, organization_name: 'Acme' }),
      { kind: 'sso', organizationName: 'Acme' }
    ],
    [
      'an SSO domain without an org name',
      jsonResponse(200, { sso: true }),
      { kind: 'sso' }
    ],
    [
      'a non-SSO domain',
      jsonResponse(200, { sso: false }),
      { kind: 'not-sso' }
    ],
    [
      'a 400 INVALID_EMAIL',
      jsonResponse(400, { code: 'INVALID_EMAIL', message: 'x' }),
      { kind: 'invalid-email' }
    ],
    [
      'a 400 with another code',
      jsonResponse(400, { code: 'OTHER', message: 'x' }),
      { kind: 'unavailable' }
    ],
    [
      'a 500',
      jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'x' }),
      { kind: 'unavailable' }
    ],
    [
      'a 502 with an HTML body',
      new Response('<html>bad gateway</html>', { status: 502 }),
      { kind: 'unavailable' }
    ],
    [
      'a 200 of the wrong shape',
      jsonResponse(200, { sso: 'yes' }),
      { kind: 'unavailable' }
    ]
  ] as const)('reads %s', async ([, response, expected]) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response)

    expect(await discoverSso('a@corp.example', { fetchImpl })).toEqual(expected)
  })

  it('answers unavailable when the request fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })

    expect(await discoverSso('a@corp.example', { fetchImpl })).toEqual({
      kind: 'unavailable'
    })
  })

  it('answers unavailable when discover outlasts its timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        })
    )

    expect(
      await discoverSso('a@corp.example', { fetchImpl, timeoutMs: 10 })
    ).toEqual({ kind: 'unavailable' })
  })

  it.for([
    ['an empty email', '   '],
    ['an email over 320 characters', `${'a'.repeat(320)}@x.io`]
  ])('rejects %s without calling the server', async ([, email]) => {
    const fetchImpl = vi.fn<typeof fetch>()

    expect(await discoverSso(email, { fetchImpl })).toEqual({
      kind: 'invalid-email'
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('safeSsoReturnTo', () => {
  it('keeps a same-origin app path with its query', () => {
    expect(safeSsoReturnTo('/workflows/x?tab=1', ORIGIN, '/')).toBe(
      '/workflows/x?tab=1'
    )
  })

  it.for([
    ['a cross-origin URL', 'https://evil.example/'],
    ['a protocol-relative URL', '//evil.example/x'],
    ['an ingest API path', '/api/auth/session'],
    ['the API root', '/API'],
    ['an API path behind a dot segment', '/x/../api/jobs'],
    ['nothing', null]
  ] as const)('falls back for %s', ([, raw]) => {
    expect(safeSsoReturnTo(raw, ORIGIN, '/cloud/user-check')).toBe(
      '/cloud/user-check'
    )
  })
})

describe('ssoStartUrl', () => {
  it('names the email and a sanitized return path on the start endpoint', () => {
    const url = new URL(
      ssoStartUrl({
        email: ' a@corp.example ',
        returnTo: '/workflows/x?tab=1',
        origin: ORIGIN
      })
    )

    expect(url.origin + url.pathname).toBe(`${ORIGIN}/api/auth/sso/start`)
    expect(url.searchParams.get('email')).toBe('a@corp.example')
    expect(url.searchParams.get('return_to')).toBe('/workflows/x?tab=1')
  })

  it('replaces an off-origin return path with the fallback', () => {
    const url = new URL(
      ssoStartUrl({
        email: 'a@corp.example',
        returnTo: 'https://evil.example/',
        origin: ORIGIN,
        fallbackReturnTo: '/cloud/user-check'
      })
    )

    expect(url.searchParams.get('return_to')).toBe('/cloud/user-check')
  })
})

describe('readSsoError', () => {
  it.for([
    ['a known code', 'SSO_USER_SUSPENDED', 'SSO_USER_SUSPENDED'],
    ['the first of repeated codes', ['RATE_LIMITED', 'X'], 'RATE_LIMITED'],
    ['a code this build predates', 'SSO_SOMETHING_NEW', 'unknown'],
    ['an empty value', '', null],
    ['no value', undefined, null]
  ] as const)('reads %s', ([, raw, expected]) => {
    expect(readSsoError(raw)).toBe(expected)
  })
})

describe('isSsoRequiredRefusal', () => {
  it.for([
    ['an ingest refusal', { code: 'sso_required', message: 'x' }, true],
    [
      'a comfy-api refusal',
      { message: 'sso_required: your organization requires single sign-on' },
      true
    ],
    ['another 403', { code: 'csrf_invalid', message: 'x' }, false],
    [
      'a message naming it mid-sentence',
      { message: 'not sso_required' },
      false
    ],
    ['no body', undefined, false]
  ] as const)('reads %s', ([, body, expected]) => {
    expect(isSsoRequiredRefusal(body)).toBe(expected)
  })
})
