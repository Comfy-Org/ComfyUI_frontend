/**
 * The whole network the app can reach, answered from the test: the Firebase
 * identity endpoints an email sign-in touches, the Cloud token exchange, and
 * every billing route the SDK reads or commands. Anything else is refused, so
 * a spec that passes here has not talked to a real service.
 *
 * Every answer is a cross-origin response as far as the browser is concerned,
 * so each one carries the CORS headers a real Cloud would, and a preflight is
 * answered before the request it guards.
 */
import type { BrowserContext, Request, Route } from '@playwright/test'

import { CLOUD_ORIGIN, E2E_ORIGIN, E2E_USER, PORTAL_URL } from './env'
import type { CloudScenario } from './scenario'
import { defaultScenario, inAnHour, succeededOperation } from './scenario'

interface RecordedRequest {
  readonly method: string
  /** Below `/api`, e.g. `/billing/status`. */
  readonly path: string
  readonly authorization: string | null
  readonly body: unknown
}

interface Reply {
  readonly status?: number
  readonly body: unknown
  readonly headers?: Record<string, string>
}

type ReplyHandler = (request: RecordedRequest) => Reply

export interface MockCloud {
  readonly scenario: CloudScenario
  /** Every billing and token request the app made, oldest first. */
  readonly requests: RecordedRequest[]
  /** Overrides the built-in answer for one method and path. */
  reply: (method: string, path: string, handler: ReplyHandler) => void
}

const CORS_HEADERS = {
  'access-control-allow-origin': E2E_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers':
    'authorization, content-type, idempotency-key, x-client-version, x-firebase-gmpid, x-firebase-client, x-client-data',
  'access-control-expose-headers': 'x-capability-revision'
}

function json(route: Route, reply: Reply): Promise<void> {
  return route.fulfill({
    status: reply.status ?? 200,
    contentType: 'application/json',
    headers: { ...CORS_HEADERS, ...reply.headers },
    body: JSON.stringify(reply.body)
  })
}

function preflight(route: Route): Promise<void> {
  return route.fulfill({ status: 204, headers: CORS_HEADERS })
}

function parseBody(request: Request): unknown {
  const raw = request.postData()
  if (raw === null || raw === '') return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function firebaseReply(request: Request): Reply {
  const url = request.url()
  const email = E2E_USER.email
  if (url.includes('accounts:signInWithPassword')) {
    return {
      body: {
        kind: 'identitytoolkit#VerifyPasswordResponse',
        localId: E2E_USER.uid,
        email,
        displayName: 'Billing E2E',
        idToken: 'e2e-firebase-id-token',
        registered: true,
        refreshToken: 'e2e-refresh-token',
        expiresIn: '3600'
      }
    }
  }
  if (url.includes('accounts:lookup')) {
    const now = String(Date.now())
    return {
      body: {
        kind: 'identitytoolkit#GetAccountInfoResponse',
        users: [
          {
            localId: E2E_USER.uid,
            email,
            emailVerified: true,
            displayName: 'Billing E2E',
            providerUserInfo: [{ providerId: 'password', email, rawId: email }],
            validSince: '0',
            lastLoginAt: now,
            createdAt: now
          }
        ]
      }
    }
  }
  return {
    status: 404,
    body: { error: { code: 404, message: 'NOT_FOUND', errors: [] } }
  }
}

const SECURETOKEN_REPLY: Reply = {
  body: {
    access_token: 'e2e-firebase-id-token',
    expires_in: '3600',
    token_type: 'Bearer',
    refresh_token: 'e2e-refresh-token',
    id_token: 'e2e-firebase-id-token',
    user_id: E2E_USER.uid,
    project_id: 'e2e'
  }
}

function builtInReply(
  scenario: CloudScenario,
  request: RecordedRequest
): Reply {
  const { method, path } = request
  if (method === 'POST' && path === '/auth/token') {
    return {
      body: {
        token: 'e2e-workspace-jwt',
        expires_at: inAnHour(),
        permissions: ['workspace:read', 'billing:write'],
        role: 'owner',
        workspace: {
          id: E2E_USER.workspaceId,
          name: 'Personal',
          type: 'personal'
        }
      }
    }
  }
  if (method === 'GET') {
    if (path === '/billing/status') return { body: scenario.status }
    if (path === '/billing/balance') return { body: scenario.balance }
    if (path === '/billing/plans') return { body: scenario.plans }
    if (path === '/billing/payment-methods')
      return { body: scenario.paymentMethods }
    if (path === '/billing/capabilities') {
      return {
        body: scenario.capabilities,
        headers: {
          'x-capability-revision': String(scenario.capabilities.revision)
        }
      }
    }
    const operation = /^\/billing\/ops\/([^/]+)$/.exec(path)
    if (operation) {
      const id = decodeURIComponent(operation[1])
      return { body: scenario.operations[id] ?? succeededOperation(id) }
    }
  }
  if (method === 'POST') {
    if (path === '/billing/preview-subscribe') return { body: scenario.preview }
    if (path === '/billing/subscribe')
      return { body: { billing_op_id: 'op_subscribe', status: 'subscribed' } }
    if (path === '/billing/subscription/cancel')
      return { body: { billing_op_id: 'op_cancel', cancel_at: inAnHour() } }
    if (path === '/billing/subscription/resubscribe')
      return { body: { billing_op_id: 'op_resubscribe', status: 'active' } }
    if (path === '/billing/payment-portal') return { body: { url: PORTAL_URL } }
  }
  return { status: 404, body: { code: 'NOT_FOUND', message: 'no such route' } }
}

export async function installMockCloud(
  context: BrowserContext
): Promise<MockCloud> {
  const scenario = defaultScenario()
  const requests: RecordedRequest[] = []
  const overrides = new Map<string, ReplyHandler>()

  // Registered first, so every more specific route below outranks it: the
  // app's own origin is served, everything else is refused.
  await context.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin
    return origin === E2E_ORIGIN
      ? route.continue()
      : route.abort('blockedbyclient')
  })

  await context.route('**/identitytoolkit.googleapis.com/**', (route) =>
    route.request().method() === 'OPTIONS'
      ? preflight(route)
      : json(route, firebaseReply(route.request()))
  )
  await context.route('**/securetoken.googleapis.com/**', (route) =>
    route.request().method() === 'OPTIONS'
      ? preflight(route)
      : json(route, SECURETOKEN_REPLY)
  )

  await context.route(`${CLOUD_ORIGIN}/api/**`, (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return preflight(route)
    const url = new URL(request.url())
    const recorded: RecordedRequest = {
      method: request.method(),
      path: url.pathname.replace(/^\/api/, ''),
      authorization: request.headers()['authorization'] ?? null,
      body: parseBody(request)
    }
    requests.push(recorded)
    const handler = overrides.get(`${recorded.method} ${recorded.path}`)
    return json(route, handler?.(recorded) ?? builtInReply(scenario, recorded))
  })

  // Where a hosted redirect lands: a page of its own, so a spec can assert
  // the navigation without the browser reaching the provider.
  await context.route(`${PORTAL_URL}*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Billing portal</title><h1>Billing portal</h1>'
    })
  )

  return {
    scenario,
    requests,
    reply: (method, path, handler) => {
      overrides.set(`${method} ${path}`, handler)
    }
  }
}
