import { describe, expect, it, vi } from 'vitest'

import type { FakeWebSessionState } from '../../testing.js'
import {
  createFakeWebSessionEndpoint,
  fakeWebSessionUser
} from '../../testing.js'
import { COMFY_CLIENT, createRequestAuthorizer } from '../requestAuth.js'
import type { WebSession } from '../sessionContracts.js'
import { readWebSession } from '../webSession.js'
import type { BillingScope } from './billingScope.js'
import { createCredentialedBillingTransport } from './credentialedTransport.js'

const BASE = 'https://cloud.test/api'
const USER = fakeWebSessionUser({ id: 'user-1' })
const SCOPE: BillingScope = {
  userId: 'user-1',
  workspaceId: 'ws-1',
  role: 'owner'
}

const STALE_SESSION: WebSession = {
  user: USER,
  csrfToken: 'stale-csrf',
  expiresAt: 0,
  absoluteExpiresAt: 0
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function refusal(code: string): Response {
  return jsonResponse(403, { code, message: code })
}

function makeTransport(
  options: {
    responses?: Response[]
    session?: WebSession | undefined
    sessionState?: FakeWebSessionState
    scope?: () => BillingScope | undefined
  } = {}
) {
  const endpoint = createFakeWebSessionEndpoint({
    state: options.sessionState ?? { kind: 'live', user: USER }
  })
  const queue = [...(options.responses ?? [jsonResponse(200, { ok: true })])]
  const fetchImpl = vi.fn<typeof fetch>(
    async () => queue.shift() ?? jsonResponse(200, { ok: true })
  )
  const transport = createCredentialedBillingTransport({
    resolveUrl: (route) => `${BASE}${route}`,
    scopeSource: {
      getScope: options.scope ?? (() => SCOPE),
      subscribe: () => () => {}
    },
    fetchImpl,
    webSession: {
      authorize: createRequestAuthorizer({
        getWorkspaceToken: () => Promise.reject(new Error('not a resource'))
      }),
      getSession: () =>
        'session' in options ? options.session : STALE_SESSION,
      readSession: ({ expectedUserId, signal }) =>
        readWebSession(
          { apiBaseUrl: BASE, fetchImpl: endpoint.fetch, signal },
          { expectedUserId }
        )
    }
  })
  const sent = () =>
    fetchImpl.mock.calls.map(([, init]) => ({
      credentials: init?.credentials,
      headers: Object.fromEntries(new Headers(init?.headers))
    }))
  return { transport, fetchImpl, endpoint, sent }
}

describe('createCredentialedBillingTransport with a web session', () => {
  it.for([
    {
      method: 'GET' as const,
      expected: {
        'x-comfy-client': COMFY_CLIENT,
        'x-comfy-workspace-id': 'ws-1'
      }
    },
    {
      method: 'POST' as const,
      expected: {
        'x-comfy-client': COMFY_CLIENT,
        'x-comfy-workspace-id': 'ws-1',
        'x-csrf-token': 'stale-csrf'
      }
    }
  ])(
    'sends the cookie headers authorize decides for a $method',
    async ({ method, expected }) => {
      const { transport, sent } = makeTransport()

      await transport({ method, route: '/billing/status' })

      expect(sent()).toEqual([
        {
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...expected }
        }
      ])
    }
  )

  it('retries csrf_invalid once with the re-read token, in the same workspace', async () => {
    const { transport, sent } = makeTransport({
      responses: [refusal('csrf_invalid'), jsonResponse(200, { ok: true })]
    })

    const result = await transport({
      method: 'POST',
      route: '/billing/topup',
      body: { amount_cents: 500 }
    })

    expect(result).toMatchObject({ status: 'ok', value: { httpStatus: 200 } })
    expect(
      sent().map(({ headers }) => [
        headers['x-csrf-token'],
        headers['x-comfy-workspace-id']
      ])
    ).toEqual([
      ['stale-csrf', 'ws-1'],
      ['fake-csrf-token', 'ws-1']
    ])
  })

  it('returns a second csrf_invalid rather than retrying again', async () => {
    const { transport, fetchImpl } = makeTransport({
      responses: [refusal('csrf_invalid'), refusal('csrf_invalid')]
    })

    const result = await transport({ method: 'POST', route: '/billing/topup' })

    expect(result).toMatchObject({ status: 'ok', value: { httpStatus: 403 } })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('abandons the request when the session now belongs to another user', async () => {
    const { transport, fetchImpl } = makeTransport({
      responses: [refusal('csrf_invalid')],
      sessionState: {
        kind: 'live',
        user: fakeWebSessionUser({ id: 'user-2' })
      }
    })

    const result = await transport({ method: 'POST', route: '/billing/topup' })

    expect(result).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it.for([
    'origin_not_allowed',
    'cross_site_request',
    'workspace_access_denied'
  ])('never retries %s or re-reads the session for it', async (code) => {
    const { transport, fetchImpl, endpoint } = makeTransport({
      responses: [refusal(code)]
    })

    const result = await transport({ method: 'POST', route: '/billing/topup' })

    expect(result).toMatchObject({
      status: 'ok',
      value: { httpStatus: 403, body: { code } }
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(endpoint.requests).toEqual([])
  })

  it.for<{ state: FakeWebSessionState; code: string }>([
    {
      state: { kind: 'dead', code: 'session_revoked' },
      code: 'NOT_AUTHENTICATED'
    },
    {
      state: { kind: 'dead', code: 'session_expired' },
      code: 'NOT_AUTHENTICATED'
    },
    { state: { kind: 'unavailable', status: 503 }, code: 'REQUEST_FAILED' }
  ])(
    'reports $code without a retry when the re-read finds $state.kind',
    async ({ state, code }) => {
      const { transport, fetchImpl } = makeTransport({
        responses: [refusal('csrf_invalid')],
        sessionState: state
      })

      const result = await transport({
        method: 'POST',
        route: '/billing/topup'
      })

      expect(result).toEqual({ status: 'error', code })
      expect(fetchImpl).toHaveBeenCalledOnce()
    }
  )

  it('does not retry once the host has left the scope the request started in', async () => {
    const scopes: Array<BillingScope | undefined> = [
      SCOPE,
      { ...SCOPE, workspaceId: 'ws-2' }
    ]
    let current = 0
    const { transport, fetchImpl, endpoint } = makeTransport({
      scope: () => scopes[current]
    })
    fetchImpl.mockImplementationOnce(async () => {
      current = 1
      return refusal('csrf_invalid')
    })

    const result = await transport({ method: 'POST', route: '/billing/topup' })

    expect(result).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(endpoint.requests).toEqual([])
  })

  it('does not replay once the host left the scope during the re-read', async () => {
    let reread = () => false
    const { transport, fetchImpl, endpoint } = makeTransport({
      responses: [refusal('csrf_invalid')],
      scope: () => (reread() ? { ...SCOPE, workspaceId: 'ws-2' } : SCOPE)
    })
    reread = () => endpoint.requests.length > 0

    const result = await transport({ method: 'POST', route: '/billing/topup' })

    expect(result).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(endpoint.requests).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('reports NOT_AUTHENTICATED without sending when there is no session', async () => {
    const { transport, fetchImpl } = makeTransport({ session: undefined })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toEqual({ status: 'error', code: 'NOT_AUTHENTICATED' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
