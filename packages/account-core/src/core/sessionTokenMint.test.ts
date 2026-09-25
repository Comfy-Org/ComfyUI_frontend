import { beforeEach, describe, expect, it } from 'vitest'

import { fakeWebSessionUser } from '../testing.js'
import { COMFY_CLIENT, createRequestAuthorizer } from './requestAuth.js'
import type { WebSession, WebSessionErrorCode } from './sessionContracts.js'
import type { SessionTokenResult } from './sessionTokenMint.js'
import {
  SessionTokenError,
  createSessionTokenMint
} from './sessionTokenMint.js'

const T0 = Date.parse('2026-09-25T00:00:00Z')
const MINUTE = 60_000

interface SentRequest {
  readonly url: string
  readonly method: string | undefined
  readonly credentials: RequestCredentials | undefined
  readonly headers: Readonly<Record<string, string>>
  readonly body: unknown
}

function sessionFor(userId: string, csrfToken = 'csrf-1'): WebSession {
  return {
    user: fakeWebSessionUser({ id: userId }),
    csrfToken,
    expiresAt: T0 + 60 * MINUTE,
    absoluteExpiresAt: T0 + 24 * 60 * MINUTE
  }
}

function tokenBody(token: string, expiresAt: number) {
  return {
    token,
    expires_at: new Date(expiresAt).toISOString(),
    workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: []
  }
}

function json(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

type Respond = (
  sent: SentRequest,
  index: number
) => Response | Promise<Response>

function setup({
  respond = (_, index) =>
    json(200, tokenBody(`jwt-${index}`, clock.now + 15 * MINUTE))
}: { respond?: Respond } = {}) {
  const sent: SentRequest[] = []
  const state: { session: WebSession | undefined } = {
    session: sessionFor('user-1')
  }
  const mint = createSessionTokenMint({
    apiBaseUrl: 'https://cloud.example/api/',
    getSession: () => state.session,
    now: () => clock.now,
    fetchImpl: async (input, init = {}) => {
      const request: SentRequest = {
        url: String(input),
        method: init.method,
        credentials: init.credentials,
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        body: JSON.parse(String(init.body))
      }
      sent.push(request)
      return respond(request, sent.length)
    }
  })
  return { mint, sent, state }
}

const clock = { now: T0 }

describe('createSessionTokenMint', () => {
  beforeEach(() => {
    clock.now = T0
  })

  it('sends nothing until a token is first asked for', async () => {
    const { mint, sent } = setup()
    expect(sent).toEqual([])

    await mint.mint()

    expect(sent).toHaveLength(1)
  })

  it.for<{ workspaceId?: string; header?: string; body: unknown }>([
    { body: {} },
    { workspaceId: 'ws-9', header: 'ws-9', body: { workspace_id: 'ws-9' } }
  ])(
    'mints from the cookie with the session headers (workspace $workspaceId)',
    async ({ workspaceId, header, body }) => {
      const { mint, sent } = setup()

      await mint.mint(workspaceId)

      const [request] = sent
      expect(request).toMatchObject({
        url: 'https://cloud.example/api/auth/token',
        method: 'POST',
        credentials: 'include',
        body
      })
      expect(request.headers).toEqual({
        'content-type': 'application/json',
        'x-comfy-client': COMFY_CLIENT,
        'x-csrf-token': 'csrf-1',
        ...(header === undefined ? {} : { 'x-comfy-workspace-id': header })
      })
    }
  )

  it('never sends a Firebase Authorization header', async () => {
    const { mint, sent } = setup()

    await mint.mint('ws-9')

    expect(sent[0].headers).not.toHaveProperty('authorization')
  })

  it('reuses a cached token until it is within the buffer of expiry', async () => {
    const { mint, sent } = setup()

    const first = await mint.getWorkspaceToken()
    clock.now = T0 + 13 * MINUTE
    const reused = await mint.getWorkspaceToken()
    clock.now = T0 + 14 * MINUTE
    const reminted = await mint.getWorkspaceToken()

    expect([first, reused, reminted]).toEqual(['jwt-1', 'jwt-1', 'jwt-2'])
    expect(sent).toHaveLength(2)
  })

  it('shares one request among concurrent callers for the same workspace', async () => {
    const { mint, sent } = setup()

    const tokens = await Promise.all([
      mint.getWorkspaceToken('ws-1'),
      mint.getWorkspaceToken('ws-1'),
      mint.getWorkspaceToken('ws-1')
    ])

    expect(tokens).toEqual(['jwt-1', 'jwt-1', 'jwt-1'])
    expect(sent).toHaveLength(1)
  })

  it('keeps one token per workspace', async () => {
    const { mint, sent } = setup()

    const personal = await mint.getWorkspaceToken()
    const team = await mint.getWorkspaceToken('ws-1')
    const otherTeam = await mint.getWorkspaceToken('ws-2')
    const again = await Promise.all([
      mint.getWorkspaceToken(),
      mint.getWorkspaceToken('ws-1'),
      mint.getWorkspaceToken('ws-2')
    ])

    expect([personal, team, otherTeam]).toEqual(['jwt-1', 'jwt-2', 'jwt-3'])
    expect(again).toEqual(['jwt-1', 'jwt-2', 'jwt-3'])
    expect(sent).toHaveLength(3)
  })

  it('drops the cache when the session user changes', async () => {
    const { mint, sent, state } = setup()

    await mint.getWorkspaceToken('ws-1')
    state.session = sessionFor('user-2', 'csrf-2')
    const forNewUser = await mint.getWorkspaceToken('ws-1')
    state.session = sessionFor('user-1')
    const backToFirst = await mint.getWorkspaceToken('ws-1')

    expect([forNewUser, backToFirst]).toEqual(['jwt-2', 'jwt-3'])
    expect(sent.map((request) => request.headers['x-csrf-token'])).toEqual([
      'csrf-1',
      'csrf-2',
      'csrf-1'
    ])
  })

  it('does not cache a token that lands after the user changed', async () => {
    let releaseFirst = () => {}
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const { mint, sent, state } = setup({
      respond: async (_, index) => {
        if (index === 1) await firstHeld
        return json(200, tokenBody(`jwt-${index}`, clock.now + 15 * MINUTE))
      }
    })

    const forFirstUser = mint.getWorkspaceToken()
    state.session = sessionFor('user-2')
    const forSecondUser = await mint.getWorkspaceToken()
    releaseFirst()
    await forFirstUser
    const afterward = await mint.getWorkspaceToken()

    expect([forSecondUser, afterward]).toEqual(['jwt-2', 'jwt-2'])
    expect(sent).toHaveLength(2)
  })

  it('answers NO_SESSION without a request when signed out', async () => {
    const { mint, sent, state } = setup()
    state.session = undefined

    expect(await mint.mint()).toMatchObject({ code: 'NO_SESSION' })
    expect(sent).toEqual([])
  })

  it.for<{
    status: number
    body: unknown
    code: WebSessionErrorCode
    retryable: boolean
  }>([
    {
      status: 401,
      body: { message: 'no session' },
      code: 'NO_SESSION',
      retryable: false
    },
    {
      status: 401,
      body: { code: 'session_expired', message: 'x' },
      code: 'SESSION_EXPIRED',
      retryable: false
    },
    {
      status: 401,
      body: { code: 'session_revoked', message: 'x' },
      code: 'SESSION_REVOKED',
      retryable: false
    },
    {
      status: 403,
      body: { code: 'csrf_invalid', message: 'x' },
      code: 'CSRF_STALE',
      retryable: false
    },
    {
      status: 403,
      body: { code: 'origin_not_allowed', message: 'x' },
      code: 'SESSION_REQUEST_REFUSED',
      retryable: false
    },
    {
      status: 403,
      body: { error: { message: 'x', type: 'auth_type_not_allowed' } },
      code: 'SESSION_REQUEST_REFUSED',
      retryable: false
    },
    {
      status: 400,
      body: { code: 'workspace_id_invalid', message: 'x' },
      code: 'SESSION_REQUEST_REFUSED',
      retryable: false
    },
    {
      status: 404,
      body: { code: 'not_found', message: 'x' },
      code: 'SESSION_REQUEST_REFUSED',
      retryable: false
    },
    { status: 500, body: {}, code: 'SESSION_UNAVAILABLE', retryable: true },
    { status: 503, body: {}, code: 'SESSION_UNAVAILABLE', retryable: true },
    {
      status: 200,
      body: { token: 'jwt' },
      code: 'SESSION_UNAVAILABLE',
      retryable: true
    }
  ])(
    'maps $status $body to $code without throwing',
    async ({ status, body, code, retryable }) => {
      const { mint } = setup({ respond: () => json(status, body) })

      const result = await mint.mint()

      expect(result).toMatchObject({
        status: 'error',
        code,
        retryable,
        httpStatus: status
      })
    }
  )

  it('maps a network failure to SESSION_UNAVAILABLE', async () => {
    const { mint } = setup({
      respond: () => {
        throw new TypeError('offline')
      }
    })

    expect(await mint.mint()).toEqual({
      status: 'error',
      code: 'SESSION_UNAVAILABLE',
      retryable: true
    })
  })

  it('refuses a token that is already expired', async () => {
    const { mint } = setup({
      respond: () => json(200, tokenBody('jwt', clock.now))
    })

    expect(await mint.mint()).toMatchObject({ code: 'SESSION_UNAVAILABLE' })
  })

  it('does not cache failures', async () => {
    const statuses = [503, 200]
    const { mint, sent } = setup({
      respond: (_, index) =>
        statuses[index - 1] === 200
          ? json(200, tokenBody('jwt-ok', clock.now + 15 * MINUTE))
          : json(503, {})
    })

    const first = await mint.mint()
    const second = await mint.mint()

    expect([first.status, second.status]).toEqual(['error', 'ok'])
    expect(sent).toHaveLength(2)
  })

  it('drops cached tokens when the session is dead', async () => {
    const { mint, sent } = setup({
      respond: (_, index) =>
        index === 2
          ? json(401, { code: 'session_revoked', message: 'x' })
          : json(200, tokenBody(`jwt-${index}`, clock.now + 15 * MINUTE))
    })

    await mint.mint()
    await mint.mint('ws-1')
    const personal = await mint.getWorkspaceToken()

    expect(personal).toBe('jwt-3')
    expect(sent).toHaveLength(3)
  })

  it('honours Retry-After on 429 before asking again', async () => {
    const { mint, sent } = setup({
      respond: (_, index) =>
        index === 1
          ? json(
              429,
              { code: 'rate_limited', message: 'x' },
              { 'Retry-After': '30' }
            )
          : json(200, tokenBody('jwt-ok', clock.now + 15 * MINUTE))
    })

    const limited = await mint.mint()
    clock.now = T0 + 29_000
    const stillLimited = await mint.mint('ws-1')
    clock.now = T0 + 30_000
    const recovered = await mint.mint()

    expect(limited).toMatchObject({
      code: 'SESSION_UNAVAILABLE',
      httpStatus: 429,
      retryAfterMs: 30_000
    })
    expect(stillLimited).toBe(limited)
    expect(recovered.status).toBe('ok')
    expect(sent).toHaveLength(2)
  })

  it('rejects getWorkspaceToken with the coded failure', async () => {
    const { mint } = setup({
      respond: () => json(403, { code: 'csrf_invalid', message: 'x' })
    })

    const pending = mint.getWorkspaceToken()

    await expect(pending).rejects.toBeInstanceOf(SessionTokenError)
    await expect(pending).rejects.toMatchObject({
      failure: { code: 'CSRF_STALE', httpStatus: 403 }
    })
  })

  it('feeds the request authorizer a Bearer token for resource calls', async () => {
    const session = sessionFor('user-1')
    const { mint } = setup()
    const authorize = createRequestAuthorizer({
      getWorkspaceToken: mint.getWorkspaceToken
    })

    const authorization = await authorize(
      { kind: 'session', session },
      { target: 'resource', method: 'GET', workspaceId: 'ws-1' }
    )

    expect(authorization).toEqual({
      headers: { Authorization: 'Bearer jwt-1' }
    })
  })

  it('returns the minted credential for the session user', async () => {
    const { mint } = setup()

    const result: SessionTokenResult = await mint.mint()

    expect(result).toMatchObject({
      status: 'ok',
      credential: {
        token: 'jwt-1',
        uid: 'user-1',
        expiresAt: T0 + 15 * MINUTE,
        role: 'owner'
      }
    })
  })
})
