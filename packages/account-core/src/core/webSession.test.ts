import { describe, expect, it, vi } from 'vitest'

import type { FakeWebSessionState } from '../testing.js'
import { createFakeWebSessionEndpoint, fakeWebSessionUser } from '../testing.js'
import type { WebSessionOptions } from './webSession.js'
import {
  createWebSession,
  deleteWebSession,
  readWebSession
} from './webSession.js'

const API = 'https://cloud.example/api'
const NOW = Date.parse('2024-06-15T12:00:00Z')

function fakeEndpoint(state: FakeWebSessionState) {
  return createFakeWebSessionEndpoint({ state, now: () => NOW })
}

function optionsFor(fetchImpl: typeof fetch): WebSessionOptions {
  return { apiBaseUrl: API, fetchImpl }
}

function respondWith(status: number, body: string): typeof fetch {
  return vi.fn<typeof fetch>(async () => new Response(body, { status }))
}

const errorBody = (code: string) => JSON.stringify({ code, message: code })

const ENDPOINTS = [
  { name: 'read', call: (o: WebSessionOptions) => readWebSession(o) },
  {
    name: 'create',
    call: (o: WebSessionOptions) => createWebSession(o, async () => 'proof')
  },
  { name: 'delete', call: (o: WebSessionOptions) => deleteWebSession(o) }
]

describe('web session status mapping', () => {
  it.for([
    {
      status: 401,
      body: errorBody('no_session'),
      code: 'NO_SESSION',
      server: 'no_session'
    },
    {
      status: 401,
      body: errorBody('session_expired'),
      code: 'SESSION_EXPIRED',
      server: 'session_expired'
    },
    {
      status: 401,
      body: errorBody('session_revoked'),
      code: 'SESSION_REVOKED',
      server: 'session_revoked'
    },
    {
      status: 401,
      body: errorBody('token_mismatch'),
      code: 'NO_SESSION',
      server: 'token_mismatch'
    },
    {
      status: 403,
      body: errorBody('csrf_invalid'),
      code: 'CSRF_STALE',
      server: 'csrf_invalid'
    },
    {
      status: 403,
      body: errorBody('workspace_access_denied'),
      code: 'WORKSPACE_ACCESS_DENIED',
      server: 'workspace_access_denied'
    },
    {
      status: 403,
      body: errorBody('origin_not_allowed'),
      code: 'SESSION_REQUEST_REFUSED',
      server: 'origin_not_allowed'
    },
    {
      status: 403,
      body: errorBody('cross_site_request'),
      code: 'SESSION_REQUEST_REFUSED',
      server: 'cross_site_request'
    },
    {
      status: 403,
      body: errorBody('FORBIDDEN'),
      code: 'SESSION_REQUEST_REFUSED',
      server: 'FORBIDDEN'
    },
    {
      status: 400,
      body: errorBody('workspace_id_invalid'),
      code: 'SESSION_REQUEST_REFUSED',
      server: 'workspace_id_invalid'
    },
    {
      status: 404,
      body: errorBody('not_found'),
      code: 'SESSION_REQUEST_REFUSED',
      server: 'not_found'
    }
  ] as const)(
    '$status $server is permanent $code',
    async ({ status, body, code, server }) => {
      const result = await readWebSession(optionsFor(respondWith(status, body)))

      expect(result).toEqual({
        status: 'error',
        code,
        retryable: false,
        httpStatus: status,
        serverCode: server
      })
    }
  )

  it.for([
    { name: '429 edge rate limit', status: 429, body: errorBody('no_session') },
    {
      name: '500 carrying a revoked code',
      status: 500,
      body: errorBody('session_revoked')
    },
    { name: '503 html page', status: 503, body: '<html>down</html>' },
    { name: '200 failing the session schema', status: 200, body: '{"user":{}}' }
  ])(
    '$name is transient, never a session verdict',
    async ({ status, body }) => {
      const result = await readWebSession(optionsFor(respondWith(status, body)))

      expect(result).toEqual({
        status: 'error',
        code: 'SESSION_UNAVAILABLE',
        retryable: true,
        httpStatus: status
      })
    }
  )

  it.for([
    {
      name: '401 without an error body',
      status: 401,
      body: '<html>401</html>'
    },
    { name: '403 without an error body', status: 403, body: '' },
    {
      name: '404 router default body',
      status: 404,
      body: '{"message":"Not Found"}'
    }
  ])(
    '$name is refused, not retryable and not a sign-out',
    async ({ status, body }) => {
      const result = await readWebSession(optionsFor(respondWith(status, body)))

      expect(result).toEqual({
        status: 'error',
        code: 'SESSION_REQUEST_REFUSED',
        retryable: false,
        httpStatus: status
      })
    }
  )

  it.for([
    { name: 'network failure', error: new TypeError('Failed to fetch') },
    { name: 'abort', error: new DOMException('Aborted', 'AbortError') }
  ])('$name is transient', async ({ error }) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw error
    })

    const result = await readWebSession(optionsFor(fetchImpl))

    expect(result).toEqual({
      status: 'error',
      code: 'SESSION_UNAVAILABLE',
      retryable: true
    })
  })

  it.for(ENDPOINTS)('$name maps a revoked session', async ({ call }) => {
    const fetchImpl = respondWith(401, errorBody('session_revoked'))

    const result = await call(optionsFor(fetchImpl))

    expect(result).toMatchObject({ code: 'SESSION_REVOKED', retryable: false })
  })

  it.for(ENDPOINTS)('$name treats a 500 as transient', async ({ call }) => {
    const result = await call(optionsFor(respondWith(500, '')))

    expect(result).toMatchObject({
      code: 'SESSION_UNAVAILABLE',
      retryable: true
    })
  })
})

describe('web session requests', () => {
  it.for([
    { name: 'read', call: readWebSession, expected: ['include'] },
    {
      name: 'create',
      call: (o: WebSessionOptions) => createWebSession(o, async () => 'proof'),
      expected: ['include', 'include']
    },
    { name: 'delete', call: deleteWebSession, expected: ['include'] }
  ])('$name always sends credentials', async ({ call, expected }) => {
    const endpoint = fakeEndpoint({ kind: 'live', user: fakeWebSessionUser() })

    await call(optionsFor(endpoint.fetch))

    expect(endpoint.requests.map((request) => request.credentials)).toEqual(
      expected
    )
  })

  it('reads the live session uncached and in SDK shape', async () => {
    const endpoint = fakeEndpoint({
      kind: 'live',
      user: fakeWebSessionUser({ id: 'u-7', email: 'a@b.c', name: undefined })
    })

    const result = await readWebSession(optionsFor(endpoint.fetch))

    expect(endpoint.requests[0]).toMatchObject({
      method: 'GET',
      path: '/api/auth/session',
      cache: 'no-store'
    })
    expect(result).toEqual({
      status: 'ok',
      session: {
        user: {
          id: 'u-7',
          email: 'a@b.c',
          emailVerified: true,
          signInProvider: 'google.com'
        },
        csrfToken: 'fake-csrf-token',
        expiresAt: Date.parse('2024-06-16T12:00:00Z'),
        absoluteExpiresAt: Date.parse('2024-06-22T12:00:00Z')
      }
    })
  })

  it('reports IDENTITY_CHANGED when the session belongs to another user', async () => {
    const endpoint = fakeEndpoint({
      kind: 'live',
      user: fakeWebSessionUser({ id: 'someone-else' })
    })

    const result = await readWebSession(optionsFor(endpoint.fetch), {
      expectedUserId: 'user-1'
    })

    expect(result).toMatchObject({
      code: 'IDENTITY_CHANGED',
      retryable: false
    })
  })

  it('creates a session from the proof and returns the signed-in user', async () => {
    const endpoint = createFakeWebSessionEndpoint({
      state: { kind: 'dead', code: 'no_session' },
      signInUser: fakeWebSessionUser({ id: 'new-user' }),
      now: () => NOW
    })

    const result = await createWebSession(
      optionsFor(endpoint.fetch),
      async () => 'id-token'
    )

    expect(endpoint.requests[0]).toMatchObject({
      method: 'POST',
      headers: { authorization: 'Bearer id-token' }
    })
    expect(result).toMatchObject({
      status: 'ok',
      session: { user: { id: 'new-user' }, csrfToken: 'fake-csrf-token' }
    })
  })

  it('reports IDENTITY_CHANGED when the created session is not the expected user', async () => {
    const endpoint = createFakeWebSessionEndpoint({
      state: { kind: 'dead', code: 'no_session' },
      signInUser: fakeWebSessionUser({ id: 'someone-else' }),
      now: () => NOW
    })

    const result = await createWebSession(
      optionsFor(endpoint.fetch),
      async () => 'id-token',
      { expectedUserId: 'new-user' }
    )

    expect(result).toMatchObject({
      status: 'error',
      code: 'IDENTITY_CHANGED',
      retryable: false
    })
  })

  it('leaves an identity-proof failure to the caller and sends nothing', async () => {
    const endpoint = fakeEndpoint({ kind: 'dead', code: 'no_session' })

    await expect(
      createWebSession(optionsFor(endpoint.fetch), () =>
        Promise.reject(new Error('signed out of the provider'))
      )
    ).rejects.toThrow('signed out of the provider')
    expect(endpoint.requests).toEqual([])
  })

  it('signs out a dead session without a CSRF token', async () => {
    const endpoint = fakeEndpoint({ kind: 'dead', code: 'session_expired' })

    const result = await deleteWebSession(optionsFor(endpoint.fetch))

    expect(result).toEqual({ status: 'ok' })
    expect(endpoint.requests[0]).toMatchObject({ method: 'DELETE' })
    expect(endpoint.requests[0].headers).not.toHaveProperty('x-csrf-token')
  })
})

describe('boot cases against the testing fake', () => {
  it.for<{ name: string; state: FakeWebSessionState; expected: object }>([
    {
      name: 'live session',
      state: { kind: 'live', user: fakeWebSessionUser() },
      expected: { status: 'ok', session: { user: { id: 'user-1' } } }
    },
    {
      name: '401 session_revoked',
      state: { kind: 'dead', code: 'session_revoked' },
      expected: { code: 'SESSION_REVOKED', retryable: false }
    },
    {
      name: '401 no_session',
      state: { kind: 'dead', code: 'no_session' },
      expected: { code: 'NO_SESSION', retryable: false }
    },
    {
      name: '401 session_expired',
      state: { kind: 'dead', code: 'session_expired' },
      expected: { code: 'SESSION_EXPIRED', retryable: false }
    },
    {
      name: 'network error',
      state: { kind: 'network_error' },
      expected: { code: 'SESSION_UNAVAILABLE', retryable: true }
    },
    {
      name: '503 outage',
      state: { kind: 'unavailable', status: 503 },
      expected: { code: 'SESSION_UNAVAILABLE', retryable: true }
    }
  ])('$name', async ({ state, expected }) => {
    const endpoint = fakeEndpoint(state)

    const result = await readWebSession(optionsFor(endpoint.fetch))

    expect(result).toMatchObject(expected)
  })
})
