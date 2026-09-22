import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import { createBalanceWatch } from './balanceWatch.js'
import { sessionBillingScopeSource } from './billingScope.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import { createCapabilitiesReader } from './capabilities.js'
import { driveEmbeddedChallenge } from './challengeDriver.js'
import { createCreditsReader } from './credits.js'
import {
  createBillingOperationLifecycle,
  operationRoute
} from './operationLifecycle.js'
import { OPERATION_POLL_TIMING } from './operationPolicy.js'
import type { BillingOpStatus } from './operationState.js'
import type { BillingStatusData } from './status.js'
import { createBillingStatusReader } from './status.js'
import type { HostedTopupCheckoutResult, TopupResult } from './topup.js'
import {
  TOPUP_CHECKOUT_ROUTE,
  TOPUP_ROUTE,
  createTopupCommand
} from './topup.js'

const NOW = 1_000_000

function credential(): AccountCredential {
  return {
    token: 'workspace-jwt',
    expiresAt: NOW + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read']
  }
}

function authenticated(session: AccountCredential): SessionSnapshot {
  return {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
}

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

type SessionFake = Pick<SessionClient, 'getSnapshot' | 'subscribe'>

function fakeSession() {
  let snapshot: SessionSnapshot = authenticated(credential())
  const listeners = new Set<(next: SessionSnapshot) => void>()
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    scopeSource: sessionBillingScopeSource(fake),
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
    }
  }
}

const STATUS_DATA: BillingStatusData = {
  billing_rail: 'stripe',
  has_funds: true,
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null
}

const CAPABILITIES = {
  can_cancel: false,
  can_change_seats: false,
  can_downgrade_to_personal: false,
  can_invite_members: false,
  can_reactivate: false,
  can_subscribe_self_serve: false,
  can_top_up: true
}

function capabilitiesBody(overrides: Record<string, unknown> = {}) {
  return {
    capabilities: CAPABILITIES,
    expires_at: new Date(NOW + 10 * 60 * 1000).toISOString(),
    resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
    revision: 42,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    ...overrides
  }
}

function balance(amountMicros: number) {
  return { amount_micros: amountMicros, currency: 'USD' }
}

const BASELINE_MICROS = 12_500_000
const TOPPED_UP_MICROS = 22_500_000

function topupResponse(overrides: Record<string, unknown> = {}) {
  return {
    amount_cents: 1000,
    billing_op_id: 'op-1',
    status: 'pending',
    topup_id: 'topup-1',
    ...overrides
  }
}

function opStatus(overrides: Partial<BillingOpStatus> = {}): BillingOpStatus {
  return {
    id: 'op-1',
    status: 'pending',
    started_at: '2026-09-14T00:00:00.000Z',
    ...overrides
  }
}

function httpOk(body: unknown): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: 200, body, header: () => null }
  }
}

function httpStatus(
  status: number,
  body: unknown = {}
): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: status, body, header: () => null }
  }
}

const NO_RESPONSE: BillingResult<BillingHttpResponse> = {
  status: 'error',
  code: 'REQUEST_FAILED'
}

type Answer = BillingResult<BillingHttpResponse>

/** Answers per route are consumed in order; the last one repeats. */
function fakeTransport() {
  const calls: BillingRequest[] = []
  const queues = new Map<string, Answer[]>()
  const keyOf = (method: string, route: string) => `${method} ${route}`
  const transport: BillingTransport = vi.fn(async (request) => {
    calls.push(request)
    const key = keyOf(request.method, request.route)
    const queue = queues.get(key)
    if (queue === undefined) return NO_RESPONSE
    const [head, ...rest] = queue
    if (rest.length > 0) queues.set(key, rest)
    return head
  })
  return {
    transport,
    calls,
    answer(method: 'GET' | 'POST', route: string, ...answers: Answer[]) {
      queues.set(keyOf(method, route), answers)
    },
    routes: () => calls.map((call) => `${call.method} ${call.route}`)
  }
}

function harness(
  options: {
    embedded?: boolean
    capabilities?: Record<string, unknown>
    balances?: number[]
  } = {}
) {
  const session = fakeSession()
  const { transport, calls, answer, routes } = fakeTransport()
  const readerOptions = { transport, scopeSource: session.scopeSource }
  const capabilities = createCapabilitiesReader(readerOptions)
  const credits = createCreditsReader(readerOptions)
  const lifecycle = createBillingOperationLifecycle({
    transport,
    scopeSource: session.scopeSource,
    statusReader: createBillingStatusReader(readerOptions),
    embeddedCheckoutAvailable: () => options.embedded === true
  })
  let attempts = 0
  const command = createTopupCommand({
    transport,
    lifecycle,
    capabilities,
    credits,
    idempotencyKey: () => `key-${++attempts}`
  })

  answer(
    'GET',
    '/billing/capabilities',
    httpOk(capabilitiesBody(options.capabilities))
  )
  answer('GET', '/billing/status', httpOk(STATUS_DATA))
  answer(
    'GET',
    '/billing/balance',
    ...(options.balances ?? [BASELINE_MICROS, TOPPED_UP_MICROS]).map((micros) =>
      httpOk(balance(micros))
    )
  )
  answer('POST', TOPUP_ROUTE, httpOk(topupResponse()))
  answer('POST', TOPUP_CHECKOUT_ROUTE, httpOk(checkoutResponse()))
  answer(
    'GET',
    operationRoute('op-1'),
    httpOk(opStatus({ status: 'succeeded' }))
  )

  return {
    command,
    lifecycle,
    capabilities,
    credits,
    session,
    calls,
    answer,
    routes,
    topup: () => command.createTopupCheckout({ amountCents: 1000 }),
    hosted: () =>
      command.createHostedTopupCheckout({
        amountCents: 1000,
        returnUrl: RETURN_URL
      })
  }
}

const RETURN_URL = 'https://comfy.org/models?topup=attempt-1'
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_123'

function checkoutResponse(overrides: Record<string, unknown> = {}) {
  return { checkout_url: CHECKOUT_URL, session_id: 'cs_test_123', ...overrides }
}

/** Lets every read, the POST, and the first poll cadence settle. */
async function settle<T>(result: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.maxMs)
  return result
}

function postedBodies(calls: BillingRequest[]) {
  return calls
    .filter((call) => call.method === 'POST')
    .map((call) => ({ body: call.body, idempotencyKey: call.idempotencyKey }))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('createTopupCommand', () => {
  it('refuses when the server resolved can_top_up false, without a POST', async () => {
    const { topup, routes } = harness({
      capabilities: {
        capabilities: { ...CAPABILITIES, can_top_up: false },
        denied_reasons: { can_top_up: 'tier_not_self_serve' }
      }
    })

    await expect(settle(topup())).resolves.toEqual({
      status: 'error',
      code: 'ACCESS_DENIED',
      denial: 'tier_not_self_serve'
    })
    expect(routes()).toEqual(['GET /billing/capabilities'])
  })

  it('settles a saved-payment-method top-up without customer action', async () => {
    const { topup, routes } = harness()

    await expect(settle(topup())).resolves.toEqual({
      status: 'ok',
      operation: expect.objectContaining({
        id: 'op-1',
        kind: 'topup',
        phase: 'succeeded'
      }),
      creditsReconciled: true
    })
    expect(routes()).toEqual([
      'GET /billing/capabilities',
      'GET /billing/balance',
      'GET /billing/status',
      `POST ${TOPUP_ROUTE}`,
      `GET ${operationRoute('op-1')}`,
      'GET /billing/balance'
    ])
  })

  it('parks a top-up that needs 3DS on the embedded challenge and settles once it is driven', async () => {
    const { topup, lifecycle, answer } = harness({ embedded: true })
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(
        opStatus({
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret'
        })
      ),
      httpOk(opStatus({ status: 'succeeded' }))
    )
    const handleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'processing' }
    }))

    const result = topup()
    await vi.advanceTimersByTimeAsync(0)
    expect(lifecycle.get('op-1')).toMatchObject({
      phase: 'pending',
      presentation: 'embedded',
      challenge: { clientSecret: 'pi_secret', status: 'required' }
    })

    await expect(
      driveEmbeddedChallenge(lifecycle, 'op-1', { handleNextAction })
    ).resolves.toBe('completed')
    expect(handleNextAction).toHaveBeenCalledWith('pi_secret')
    await expect(settle(result)).resolves.toMatchObject({
      status: 'ok',
      operation: { phase: 'succeeded' }
    })
  })

  it('maps a NO_PAYMENT_METHOD error body to a replace-payment-method recovery without its text', async () => {
    const { topup, answer, routes } = harness()
    answer(
      'POST',
      TOPUP_ROUTE,
      httpStatus(402, {
        code: 'NO_PAYMENT_METHOD',
        message: 'Stripe customer cus_123 has no default payment method'
      })
    )

    const result = await settle(topup())

    expect(result).toEqual({
      status: 'error',
      code: 'NO_PAYMENT_METHOD',
      recoveryAction: 'replace_payment_method'
    })
    expect(JSON.stringify(result)).not.toContain('Stripe')
    expect(routes()).not.toContain(`GET ${operationRoute('op-1')}`)
  })

  it('reports a decline with its coded reason and never the provider text', async () => {
    const { topup, capabilities, answer, routes } = harness()
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(
        opStatus({
          status: 'failed',
          decline_reason: 'card_declined',
          recovery_action: 'replace_payment_method',
          retryable: true,
          error_message: 'Your card was declined by Stripe.'
        })
      )
    )

    const result = await settle(topup())

    expect(result).toEqual({
      status: 'declined',
      operation: expect.objectContaining({
        id: 'op-1',
        phase: 'failed',
        declineReason: 'card_declined',
        recoveryAction: 'replace_payment_method',
        retryable: true
      })
    })
    expect(JSON.stringify(result)).not.toContain('Stripe')

    await capabilities.read()
    expect(
      routes().filter((route) => route === 'GET /billing/capabilities')
    ).toHaveLength(1)
    expect(
      routes().filter((route) => route === 'GET /billing/balance')
    ).toHaveLength(1)
  })

  it.for([
    ['a 5xx', httpStatus(500)],
    ['no response', NO_RESPONSE]
  ] as const)(
    'reports %s on the POST as the transient failure',
    async ([, answerToPost]) => {
      const { topup, answer } = harness()
      answer('POST', TOPUP_ROUTE, answerToPost)

      await expect(settle(topup())).resolves.toMatchObject({
        status: 'error',
        code: 'REQUEST_FAILED'
      })
    }
  )

  it('reports payment received with credits pending when the balance has not moved', async () => {
    const { topup } = harness({ balances: [BASELINE_MICROS, BASELINE_MICROS] })

    await expect(settle(topup())).resolves.toMatchObject({
      status: 'ok',
      operation: { phase: 'succeeded' },
      creditsReconciled: false
    })
  })

  it('maps a 404 on the POST to NOT_AVAILABLE and leaves a 404 while polling to the lifecycle', async () => {
    const notDeployed = harness()
    notDeployed.answer('POST', TOPUP_ROUTE, httpStatus(404))
    await expect(settle(notDeployed.topup())).resolves.toEqual({
      status: 'error',
      code: 'NOT_AVAILABLE'
    })

    const lost = harness()
    lost.answer('GET', operationRoute('op-1'), httpStatus(404))
    await expect(settle(lost.topup())).resolves.toEqual({
      status: 'unsettled',
      operation: expect.objectContaining({
        id: 'op-1',
        phase: 'reconciliation_needed'
      })
    })
  })

  it('sends one fresh idempotency key per attempt in the body and on the request, so a 401 replay is deduplicated', async () => {
    const { topup, answer, calls } = harness()
    answer('POST', TOPUP_ROUTE, httpStatus(503), httpOk(topupResponse()))

    await expect(settle(topup())).resolves.toMatchObject({
      code: 'REQUEST_FAILED'
    })
    await expect(settle(topup())).resolves.toMatchObject({ status: 'ok' })

    const posts = postedBodies(calls)
    expect(posts).toEqual([
      {
        body: { amount_cents: 1000, idempotency_key: 'key-1' },
        idempotencyKey: 'key-1'
      },
      {
        body: { amount_cents: 1000, idempotency_key: 'key-2' },
        idempotencyKey: 'key-2'
      }
    ])
    expect(() => JSON.stringify(posts[0].body)).not.toThrow()
  })

  it('rejects an amount below the generated minimum without sending anything', async () => {
    const { command, calls } = harness()

    await expect(
      command.createTopupCheckout({ amountCents: 100 })
    ).resolves.toEqual({ status: 'error', code: 'INVALID_AMOUNT' })
    expect(calls).toHaveLength(0)
  })

  it('reports a response outside the generated contract as MALFORMED_RESPONSE', async () => {
    const { topup, answer, routes } = harness()
    answer(
      'POST',
      TOPUP_ROUTE,
      httpOk({ ...topupResponse(), status: 'queued' })
    )

    await expect(settle(topup())).resolves.toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
    expect(routes()).not.toContain(`GET ${operationRoute('op-1')}`)
  })

  it('invalidates the capabilities read and re-reads credits on success', async () => {
    const { topup, capabilities, routes } = harness()

    await settle(topup())
    await capabilities.read()

    expect(
      routes().filter((route) => route === 'GET /billing/capabilities')
    ).toHaveLength(2)
    expect(
      routes().filter((route) => route === 'GET /billing/balance')
    ).toHaveLength(2)
  })

  it('passes a superseded scope through without attributing anything to the new one', async () => {
    const { topup, session, answer, routes } = harness()
    answer('GET', operationRoute('op-1'), httpOk(opStatus()))

    const result = topup()
    await vi.advanceTimersByTimeAsync(0)
    session.moveTo(SIGNED_OUT)

    await expect(settle(result)).resolves.toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })
    expect(
      routes().filter((route) => route === 'GET /billing/balance')
    ).toHaveLength(1)
  })

  it('falls back to a balance watch when no billing_op_id can be observed, inventing none', async () => {
    const { topup, credits, answer, routes } = harness({
      balances: [BASELINE_MICROS, BASELINE_MICROS, TOPPED_UP_MICROS]
    })
    const { billing_op_id: _omitted, ...withoutId } = topupResponse()
    answer('POST', TOPUP_ROUTE, httpOk(withoutId))

    await expect(settle(topup())).resolves.toMatchObject({
      code: 'MALFORMED_RESPONSE'
    })
    expect(routes().some((route) => route.includes('/billing/ops/'))).toBe(
      false
    )

    const watch = createBalanceWatch({
      credits,
      baselineMicros: credits.getSnapshot()?.balance.amount_micros
    })
    watch.wake()
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(watch.outcome).resolves.toBe('reconciled')
    expect(
      routes().filter((route) => route === 'GET /billing/balance')
    ).toHaveLength(3)
  })
})

describe('createHostedTopupCheckout', () => {
  it('returns the hosted session with the pre-purchase baseline and observes no operation', async () => {
    const { hosted, lifecycle, routes, calls } = harness()

    await expect(hosted()).resolves.toEqual({
      status: 'ok',
      url: CHECKOUT_URL,
      sessionId: 'cs_test_123',
      baselineMicros: BASELINE_MICROS
    })
    expect(routes()).toEqual([
      'GET /billing/capabilities',
      'GET /billing/balance',
      `POST ${TOPUP_CHECKOUT_ROUTE}`
    ])
    expect(lifecycle.getSnapshot()).toEqual([])
    expect(postedBodies(calls)).toEqual([
      {
        body: {
          amount_cents: 1000,
          return_url: RETURN_URL,
          idempotency_key: 'key-1'
        },
        idempotencyKey: 'key-1'
      }
    ])
  })

  it('refuses when the server resolved can_top_up false, without a POST', async () => {
    const { hosted, routes } = harness({
      capabilities: {
        capabilities: { ...CAPABILITIES, can_top_up: false },
        denied_reasons: { can_top_up: 'tier_not_self_serve' }
      }
    })

    await expect(hosted()).resolves.toEqual({
      status: 'error',
      code: 'ACCESS_DENIED',
      denial: 'tier_not_self_serve'
    })
    expect(routes()).toEqual(['GET /billing/capabilities'])
  })

  it('rejects an amount or return URL outside the generated contract without sending anything', async () => {
    const { command, calls } = harness()

    await expect(
      command.createHostedTopupCheckout({
        amountCents: 100,
        returnUrl: RETURN_URL
      })
    ).resolves.toEqual({ status: 'error', code: 'INVALID_AMOUNT' })
    await expect(
      command.createHostedTopupCheckout({
        amountCents: 1000,
        returnUrl: 'models?topup=1'
      })
    ).resolves.toEqual({ status: 'error', code: 'INVALID_RETURN_URL' })
    expect(calls).toHaveLength(0)
  })

  it('maps a 404 to NOT_AVAILABLE so a host keeps its legacy path', async () => {
    const { hosted, answer } = harness()
    answer('POST', TOPUP_CHECKOUT_ROUTE, httpStatus(404))

    await expect(hosted()).resolves.toEqual({
      status: 'error',
      code: 'NOT_AVAILABLE'
    })
  })

  it('reports a session outside the generated contract or off https as MALFORMED_RESPONSE', async () => {
    const { hosted, answer } = harness()

    answer('POST', TOPUP_CHECKOUT_ROUTE, httpOk({ session_id: 'cs_test_123' }))
    await expect(hosted()).resolves.toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })

    answer(
      'POST',
      TOPUP_CHECKOUT_ROUTE,
      httpOk(checkoutResponse({ checkout_url: 'http://checkout.stripe.com/c' }))
    )
    await expect(hosted()).resolves.toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
  })

  it('omits what it could not learn: no session id, no baseline', async () => {
    const { hosted, answer } = harness()
    answer('GET', '/billing/balance', httpStatus(503))
    const { session_id: _omitted, ...withoutSession } = checkoutResponse()
    answer('POST', TOPUP_CHECKOUT_ROUTE, httpOk(withoutSession))

    await expect(hosted()).resolves.toEqual({
      status: 'ok',
      url: CHECKOUT_URL
    })
  })

  it('hands the baseline to a balance watch that settles once the host returns', async () => {
    const { hosted, credits, routes } = harness({
      balances: [BASELINE_MICROS, TOPPED_UP_MICROS]
    })
    const session = await hosted()
    if (session.status !== 'ok') throw new Error(session.code)

    const watch = createBalanceWatch({
      credits,
      baselineMicros: session.baselineMicros
    })
    watch.wake()
    await vi.advanceTimersByTimeAsync(0)

    await expect(watch.outcome).resolves.toBe('reconciled')
    expect(
      routes().filter((route) => route === 'GET /billing/balance')
    ).toHaveLength(2)
  })

  it('carries the server code and message of a refusal', async () => {
    const { hosted, answer } = harness()
    answer(
      'POST',
      TOPUP_CHECKOUT_ROUTE,
      httpStatus(400, {
        code: 'INVALID_RETURN_URL',
        message: 'stripe: return_url origin not allowlisted'
      })
    )

    const result: HostedTopupCheckoutResult = await hosted()

    expect(result).toEqual({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 400,
      serverCode: 'INVALID_RETURN_URL',
      serverMessage: 'stripe: return_url origin not allowlisted'
    })
  })
})

describe('TopupResult', () => {
  it('carries the server code and message of a 5xx', async () => {
    const { topup, answer } = harness()
    answer(
      'POST',
      TOPUP_ROUTE,
      httpStatus(500, {
        code: 'INTERNAL',
        message: 'stripe: idempotency clash'
      })
    )

    const result: TopupResult = await settle(topup())

    expect(result).toEqual({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 500,
      serverCode: 'INTERNAL',
      serverMessage: 'stripe: idempotency clash'
    })
  })
})
