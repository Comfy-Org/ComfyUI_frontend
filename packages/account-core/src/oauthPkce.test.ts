import { describe, expect, it, vi } from 'vitest'

import {
  authorizeUrl,
  codeChallengeS256,
  createPkceRequest,
  exchangeAuthorizationCode,
  localRedirectUri,
  readAuthorizationResponse,
  refreshAccessToken
} from './oauthPkce'

const ISSUER = 'https://cloud.example.test'
const NOW = 1_700_000_000_000

const tokenBody = {
  access_token: 'access-1',
  expires_in: 3600,
  refresh_token: 'refresh-1',
  scope: 'comfy-cloud:user:read',
  token_type: 'Bearer'
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function tokenOptions(fetchImpl: typeof fetch) {
  return {
    issuer: ISSUER,
    clientId: 'comfy-local-web',
    fetchImpl,
    now: () => NOW
  }
}

describe('codeChallengeS256', () => {
  it('is the unpadded base64url SHA-256 of the verifier', async () => {
    await expect(
      codeChallengeS256('dBjftJeZ4CVP-mJ92IjrB9V8u2D7ZTy-B-Rs5A5bM5Ge')
    ).resolves.toBe('_7ZG1aE3MBd6R8lydEjpm_v7j7LK4DRg0vuQMzMV1HE')
  })
})

describe('createPkceRequest', () => {
  it('makes a 43-character URL-safe verifier and state, and challenges the verifier', async () => {
    const request = await createPkceRequest()

    expect(request.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(request.state).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(request.challenge).toBe(await codeChallengeS256(request.verifier))
  })

  it('never repeats a verifier or state', async () => {
    const [first, second] = await Promise.all([
      createPkceRequest(),
      createPkceRequest()
    ])

    expect(second.verifier).not.toBe(first.verifier)
    expect(second.state).not.toBe(first.state)
  })
})

describe('localRedirectUri', () => {
  it.for([
    ['http://127.0.0.1:8188', 'http://127.0.0.1:8188/'],
    ['http://localhost:8188', 'http://localhost:8188/'],
    ['http://[::1]:8188', 'http://[::1]:8188/']
  ])('is the root of %s', ([origin, expected]) => {
    expect(localRedirectUri(origin)).toBe(expected)
  })
})

describe('authorizeUrl', () => {
  it('asks for an S256 code for the comfy-cloud resource', () => {
    const url = new URL(
      authorizeUrl({
        issuer: ISSUER,
        clientId: 'comfy-local-web',
        redirectUri: 'http://127.0.0.1:8188/',
        challenge: 'challenge-1',
        state: 'state-1'
      })
    )

    expect(url.origin + url.pathname).toBe(`${ISSUER}/oauth/authorize`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'comfy-local-web',
      redirect_uri: 'http://127.0.0.1:8188/',
      code_challenge: 'challenge-1',
      code_challenge_method: 'S256',
      state: 'state-1',
      resource: `${ISSUER}/api`
    })
  })
})

describe('readAuthorizationResponse', () => {
  it.for([
    { name: 'no OAuth params', query: 'foo=1', expected: { kind: 'none' } },
    {
      name: 'a code with the expected state',
      query: 'code=abc&state=s1',
      expected: { kind: 'code', code: 'abc' }
    },
    {
      name: 'an error with the expected state',
      query: 'error=access_denied&state=s1',
      expected: { kind: 'denied', error: 'access_denied' }
    },
    {
      name: 'an empty code',
      query: 'code=&state=s1',
      expected: { kind: 'denied', error: 'invalid_request' }
    },
    {
      name: 'a code with another state',
      query: 'code=abc&state=s2',
      expected: { kind: 'state-mismatch' }
    },
    {
      name: 'a code without state',
      query: 'code=abc',
      expected: { kind: 'state-mismatch' }
    }
  ])('reads $name', ({ query, expected }) => {
    expect(readAuthorizationResponse(new URLSearchParams(query), 's1')).toEqual(
      expected
    )
  })

  it('refuses a code when this browser sent no state', () => {
    expect(
      readAuthorizationResponse(
        new URLSearchParams('code=abc&state=s1'),
        undefined
      )
    ).toEqual({ kind: 'state-mismatch' })
  })
})

describe('exchangeAuthorizationCode', () => {
  it('posts the code grant as a form and returns tokens with an absolute expiry', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, tokenBody)
    )

    const result = await exchangeAuthorizationCode(
      {
        code: 'code-1',
        verifier: 'verifier-1',
        redirectUri: 'http://127.0.0.1:8188/'
      },
      tokenOptions(fetchImpl)
    )

    expect(result).toEqual({
      ok: true,
      tokens: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: NOW + 3_600_000,
        scope: 'comfy-cloud:user:read'
      }
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${ISSUER}/oauth/token`)
    expect(init?.method).toBe('POST')
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual(
      {
        grant_type: 'authorization_code',
        code: 'code-1',
        code_verifier: 'verifier-1',
        redirect_uri: 'http://127.0.0.1:8188/',
        client_id: 'comfy-local-web'
      }
    )
  })
})

describe('refreshAccessToken', () => {
  it('posts the refresh grant and returns the rotated pair', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { ...tokenBody, refresh_token: 'refresh-2' })
    )

    const result = await refreshAccessToken(
      'refresh-1',
      tokenOptions(fetchImpl)
    )

    expect(result).toMatchObject({
      ok: true,
      tokens: { refreshToken: 'refresh-2' }
    })
    const [, init] = fetchImpl.mock.calls[0]
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual(
      {
        grant_type: 'refresh_token',
        refresh_token: 'refresh-1',
        client_id: 'comfy-local-web'
      }
    )
  })
})

describe('token grant failures', () => {
  it.for([
    {
      name: 'invalid_grant',
      respond: () => jsonResponse(400, { error: 'invalid_grant' }),
      expected: { ok: false, reason: 'invalid_grant', error: 'invalid_grant' }
    },
    {
      name: 'another OAuth error',
      respond: () => jsonResponse(400, { error: 'invalid_client' }),
      expected: { ok: false, reason: 'rejected', error: 'invalid_client' }
    },
    {
      name: 'a server error',
      respond: () => jsonResponse(503, { error: 'temporarily_unavailable' }),
      expected: { ok: false, reason: 'unavailable' }
    },
    {
      name: 'a 4xx that is not OAuth',
      respond: () => new Response('<html>blocked</html>', { status: 403 }),
      expected: { ok: false, reason: 'unavailable' }
    },
    {
      name: 'a 200 missing the refresh token',
      respond: () =>
        jsonResponse(200, { ...tokenBody, refresh_token: undefined }),
      expected: { ok: false, reason: 'unavailable' }
    },
    {
      name: 'a network failure',
      respond: () => Promise.reject(new TypeError('Failed to fetch')),
      expected: { ok: false, reason: 'unavailable' }
    }
  ])('returns $name as data', async ({ respond, expected }) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => respond())

    await expect(
      refreshAccessToken('refresh-1', tokenOptions(fetchImpl))
    ).resolves.toEqual(expected)
  })

  it('gives up as unavailable when the server does not answer in time', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
    )

    const pending = refreshAccessToken('refresh-1', {
      ...tokenOptions(fetchImpl),
      timeoutMs: 1000
    })
    await vi.advanceTimersByTimeAsync(1000)

    await expect(pending).resolves.toEqual({ ok: false, reason: 'unavailable' })
  })

  it.for([
    'http://cloud.example.test',
    'ftp://cloud.example.test',
    'http://cloud.example.test.localhost.evil'
  ])('never sends a grant to the non-HTTPS issuer %s', async (issuer) => {
    const fetchImpl = vi.fn<typeof fetch>()

    await expect(
      refreshAccessToken('refresh-1', { ...tokenOptions(fetchImpl), issuer })
    ).resolves.toEqual({ ok: false, reason: 'unavailable' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends grants over plain HTTP to a loopback issuer', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, tokenBody)
    )

    await refreshAccessToken('refresh-1', {
      ...tokenOptions(fetchImpl),
      issuer: 'http://localhost:8000'
    })

    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:8000/oauth/token')
  })
})
