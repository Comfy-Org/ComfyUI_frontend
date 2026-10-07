import {
  assert,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi
} from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import { sessionBillingScopeSource } from './billingScope.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type { CapabilitiesReader } from './capabilities.js'
import { driveEmbeddedChallenge } from './challengeDriver.js'
import type { CreditsReader } from './credits.js'
import {
  createBillingOperationLifecycle,
  operationRoute
} from './operationLifecycle.js'
import {
  OPERATION_POLL_BUDGET,
  OPERATION_POLL_TIMING
} from './operationPolicy.js'
import type { BillingOpStatus } from './operationState.js'
import type {
  BillingStatusData,
  BillingStatusReader,
  BillingStatusSnapshot
} from './status.js'
import type { SubscriptionPreview } from './subscriptionCommands.js'
import {
  CANCEL_SUBSCRIPTION_ROUTE,
  PAYMENT_PORTAL_ROUTE,
  PREVIEW_SUBSCRIBE_ROUTE,
  RESUBSCRIBE_ROUTE,
  SUBSCRIBE_ROUTE,
  cancelOperationRoute,
  createBillingCommands
} from './subscriptionCommands.js'

const NOW = 1_000_000
const SCOPE = { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' } as const
const PLAN = { plan_slug: 'pro-monthly' }
const SERVER_TEXT = 'Stripe: card_declined (do_not_honor) for cus_123'

function credential(
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return {
    token: 'workspace-jwt',
    expiresAt: NOW + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  }
}

function authenticated(session: AccountCredential): SessionSnapshot {
  return {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
}

function fakeSession() {
  let snapshot = authenticated(credential())
  const listeners = new Set<(next: SessionSnapshot) => void>()
  const fake: Pick<SessionClient, 'getSnapshot' | 'subscribe'> = {
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
      for (const listener of Array.from(listeners)) listener(snapshot)
    }
  }
}

const BASE_STATUS: BillingStatusData = {
  billing_rail: 'stripe',
  has_funds: true,
  is_active: false,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null
}

const FREE: Partial<BillingStatusData> = { subscription_tier: 'FREE' }
const PRO_ACTIVE: Partial<BillingStatusData> = {
  is_active: true,
  subscription_tier: 'PRO',
  subscription_status: 'active'
}
const PRO_CANCELED: Partial<BillingStatusData> = {
  is_active: true,
  subscription_tier: 'PRO',
  subscription_status: 'canceled',
  cancel_at: '2026-10-01T00:00:00.000Z'
}

function statusSnapshot(
  overrides: Partial<BillingStatusData>
): BillingResult<BillingStatusSnapshot> {
  return {
    status: 'ok',
    value: {
      status: { ...BASE_STATUS, ...overrides },
      scope: SCOPE,
      readAt: NOW
    }
  }
}

function fakeStatusReader(initial: BillingResult<BillingStatusSnapshot>) {
  let answer = initial
  const read = vi.fn(async () => answer)
  const reader: BillingStatusReader = {
    read,
    getSnapshot: () => undefined,
    dispose: () => {}
  }
  return {
    reader,
    read,
    answer(next: BillingResult<BillingStatusSnapshot>) {
      answer = next
    }
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

function http(
  httpStatus: number,
  body: unknown = {},
  extra: Pick<BillingHttpResponse, 'authenticationRetrySkipped'> = {}
): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus, body, header: () => null, ...extra }
  }
}

function serverError(httpStatus: number, code: string) {
  return http(httpStatus, { code, message: SERVER_TEXT })
}

type Answer =
  | BillingResult<BillingHttpResponse>
  | Promise<BillingResult<BillingHttpResponse>>

/** Answers per `METHOD route`, consumed in order; the last one repeats. */
function fakeTransport(script: Partial<Record<string, Answer[]>>) {
  const calls: BillingRequest[] = []
  const served = new Map<string, number>()
  const transport: BillingTransport = vi.fn(async (request) => {
    calls.push(request)
    const key = `${request.method} ${request.route}`
    const answers = script[key] ?? [http(404)]
    const index = served.get(key) ?? 0
    served.set(key, index + 1)
    return answers[Math.min(index, answers.length - 1)]
  })
  return { transport, calls }
}

function harness(options: {
  status: Partial<BillingStatusData>
  script?: Partial<Record<string, Answer[]>>
  embedded?: boolean
}) {
  const session = fakeSession()
  const status = fakeStatusReader(statusSnapshot(options.status))
  const { transport, calls } = fakeTransport(options.script ?? {})
  const lifecycle = createBillingOperationLifecycle({
    transport,
    scopeSource: session.scopeSource,
    statusReader: status.reader,
    embeddedCheckoutAvailable: () => options.embedded === true
  })
  const invalidate = vi.fn()
  const capabilities: CapabilitiesReader = {
    read: vi.fn(),
    getSnapshot: () => undefined,
    invalidate,
    dispose: () => {}
  }
  const readCredits = vi.fn(
    async (): Promise<BillingResult<never>> => ({
      status: 'error',
      code: 'REQUEST_FAILED'
    })
  )
  const credits: CreditsReader = {
    read: readCredits,
    getSnapshot: () => undefined,
    dispose: () => {}
  }
  const keys = ['key-1', 'key-2', 'key-3']
  const commands = createBillingCommands({
    transport,
    lifecycle,
    statusReader: status.reader,
    capabilities,
    credits,
    idempotencyKey: () => keys.shift() ?? 'key-n'
  })
  const posts = () => calls.filter((call) => call.method === 'POST')
  return {
    commands,
    lifecycle,
    session,
    status,
    calls,
    posts,
    invalidate,
    readCredits
  }
}

const POST_SUBSCRIBE = `POST ${SUBSCRIBE_ROUTE}`
const POST_RESUBSCRIBE = `POST ${RESUBSCRIBE_ROUTE}`
const POST_CANCEL = `POST ${CANCEL_SUBSCRIPTION_ROUTE}`
const POST_PORTAL = `POST ${PAYMENT_PORTAL_ROUTE}`
const POST_PREVIEW = `POST ${PREVIEW_SUBSCRIBE_ROUTE}`
const GET_OP = `GET ${operationRoute('op-1')}`
const POST_CANCEL_OP = `POST ${cancelOperationRoute('op-1')}`

const subscribed = http(200, { billing_op_id: 'op-1', status: 'subscribed' })
const pendingPayment = http(200, {
  billing_op_id: 'op-1',
  status: 'pending_payment'
})
const settledOk = [http(200, opStatus({ status: 'succeeded' }))]

const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('createBillingCommands', () => {
  describe('each command against the subscription state', () => {
    it('FREE: subscribe issues the checkout and settles the operation', async () => {
      const h = harness({
        status: FREE,
        script: { [POST_SUBSCRIBE]: [subscribed], [GET_OP]: settledOk }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded', operation: { id: 'op-1' } }
      })
      expect(h.posts()).toEqual([
        expect.objectContaining({
          route: SUBSCRIBE_ROUTE,
          body: { plan_slug: 'pro-monthly', idempotency_key: 'key-1' },
          idempotencyKey: 'key-1'
        })
      ])
      expect(h.invalidate).toHaveBeenCalledOnce()
      expect(h.readCredits).toHaveBeenCalledOnce()
    })

    it('FREE: resubscribe surfaces NO_ACTIVE_SUBSCRIPTION as a coded error', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_RESUBSCRIBE]: [serverError(400, 'NO_ACTIVE_SUBSCRIPTION')]
        }
      })

      const result = await h.commands.resubscribe()

      expect(result).toEqual({
        status: 'error',
        code: 'NO_ACTIVE_SUBSCRIPTION'
      })
      expect(h.invalidate).not.toHaveBeenCalled()
    })

    it('FREE: cancel surfaces NO_ACTIVE_SUBSCRIPTION as a coded error', async () => {
      const h = harness({
        status: FREE,
        script: { [POST_CANCEL]: [serverError(400, 'NO_ACTIVE_SUBSCRIPTION')] }
      })

      await expect(h.commands.cancelSubscription()).resolves.toEqual({
        status: 'error',
        code: 'NO_ACTIVE_SUBSCRIPTION'
      })
      expect(h.lifecycle.getSnapshot()).toEqual([])
    })

    it.for(
      [
        {
          name: 'cancel',
          route: POST_CANCEL,
          run: (h: ReturnType<typeof harness>) =>
            h.commands.cancelSubscription()
        },
        {
          name: 'resubscribe',
          route: POST_RESUBSCRIBE,
          run: (h: ReturnType<typeof harness>) => h.commands.resubscribe()
        },
        {
          name: 'subscribe',
          route: POST_SUBSCRIBE,
          run: (h: ReturnType<typeof harness>) => h.commands.subscribe(PLAN)
        }
      ].flatMap((command) => [
        { ...command, httpStatus: 400, expected: 'OPERATION_ALREADY_PENDING' },
        { ...command, httpStatus: 503, expected: 'REQUEST_FAILED' }
      ])
    )(
      'PRO active: $name answered $httpStatus SUBSCRIPTION_CHANGE_IN_PROGRESS is $expected',
      async ({ route, run, httpStatus, expected }) => {
        const h = harness({
          status: PRO_ACTIVE,
          script: {
            [route]: [
              serverError(httpStatus, 'SUBSCRIPTION_CHANGE_IN_PROGRESS')
            ]
          }
        })

        await expect(run(h)).resolves.toMatchObject({
          status: 'error',
          code: expected
        })
        expect(h.invalidate).not.toHaveBeenCalled()
      }
    )

    it('PRO active: subscribe issues the plan change the server has to price', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: { [POST_SUBSCRIBE]: [subscribed], [GET_OP]: settledOk }
      })

      const result = await h.commands.subscribe({ plan_slug: 'pro-yearly' })

      expect(result).toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded', operation: { id: 'op-1' } }
      })
      expect(h.posts()).toEqual([
        expect.objectContaining({
          route: SUBSCRIBE_ROUTE,
          body: { plan_slug: 'pro-yearly', idempotency_key: 'key-1' }
        })
      ])
      expect(h.invalidate).toHaveBeenCalledOnce()
    })

    it('PRO active: subscribe leaves the server to refuse a transition, code intact', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: {
          [POST_SUBSCRIBE]: [serverError(409, 'TRANSITION_NOT_ALLOWED')]
        }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toMatchObject({
        status: 'error',
        serverCode: 'TRANSITION_NOT_ALLOWED',
        httpStatus: 409
      })
      expect(h.posts().map((call) => call.route)).toEqual([SUBSCRIBE_ROUTE])
    })

    it('PRO active: resubscribe already holds and re-reads status', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: {
          [POST_RESUBSCRIBE]: [
            serverError(400, 'NOT_SCHEDULED_FOR_CANCELLATION')
          ]
        }
      })

      const result = await h.commands.resubscribe()

      expect(result).toEqual({ status: 'ok', value: { phase: 'succeeded' } })
      expect(h.status.read).toHaveBeenCalledTimes(2)
      expect(h.invalidate).toHaveBeenCalledOnce()
      expect(h.readCredits).toHaveBeenCalledOnce()
      expect(h.lifecycle.getSnapshot()).toEqual([])
    })

    it('PRO active: cancel settles the cancel operation and re-reads status for cancel_at', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: {
          [POST_CANCEL]: [
            http(200, {
              billing_op_id: 'op-1',
              cancel_at: '2026-10-01T00:00:00.000Z'
            })
          ],
          [GET_OP]: settledOk
        }
      })

      const result = await h.commands.cancelSubscription()

      expect(result).toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded', operation: { id: 'op-1', kind: 'cancel' } }
      })
      expect(h.posts()[0]).toMatchObject({
        body: { idempotency_key: 'key-1' },
        idempotencyKey: 'key-1'
      })
      expect(h.status.read).toHaveBeenCalledTimes(2)
      expect(h.invalidate).toHaveBeenCalledOnce()
    })

    it('PRO canceled: subscribe carries the requested plan to the subscribe route', async () => {
      const h = harness({
        status: PRO_CANCELED,
        script: { [POST_SUBSCRIBE]: [subscribed], [GET_OP]: settledOk }
      })

      const result = await h.commands.subscribe({
        plan_slug: 'pro-yearly',
        confirm_reactivation: true
      })

      expect(result).toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded', operation: { id: 'op-1' } }
      })
      expect(h.posts()).toEqual([
        expect.objectContaining({
          route: SUBSCRIBE_ROUTE,
          body: {
            plan_slug: 'pro-yearly',
            confirm_reactivation: true,
            idempotency_key: 'key-1'
          }
        })
      ])
    })

    it('PRO canceled: subscribe hands the server its reactivation block back', async () => {
      const h = harness({
        status: PRO_CANCELED,
        script: {
          [POST_SUBSCRIBE]: [
            serverError(409, 'REACTIVATION_CONFIRMATION_REQUIRED')
          ]
        }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toEqual({
        status: 'error',
        code: 'REACTIVATION_CONFIRMATION_REQUIRED'
      })
      expect(h.posts().map((call) => call.route)).toEqual([SUBSCRIBE_ROUTE])
    })

    it('PRO canceled: resubscribe settles a pending reactivation through the lifecycle', async () => {
      const h = harness({
        status: PRO_CANCELED,
        script: {
          [POST_RESUBSCRIBE]: [
            http(200, {
              billing_op_id: 'op-1',
              status: 'pending',
              message: SERVER_TEXT
            })
          ],
          [GET_OP]: [http(200, opStatus()), ...settledOk]
        }
      })

      const result = h.commands.resubscribe()
      await flush()
      expect(h.lifecycle.get('op-1')).toMatchObject({ phase: 'pending' })
      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.initialMs * 1.5)

      const settled = await result
      expect(settled).toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded' }
      })
      expect(JSON.stringify(settled)).not.toContain('Stripe')
    })

    it('PRO canceled: cancel already holds and re-reads status', async () => {
      const h = harness({
        status: PRO_CANCELED,
        script: { [POST_CANCEL]: [serverError(409, 'ALREADY_CANCELED')] }
      })

      const result = await h.commands.cancelSubscription()

      expect(result).toEqual({ status: 'ok', value: { phase: 'succeeded' } })
      expect(h.status.read).toHaveBeenCalledTimes(2)
      expect(h.invalidate).toHaveBeenCalledOnce()
    })

    it.for([
      { name: 'FREE', status: FREE },
      { name: 'PRO active', status: PRO_ACTIVE },
      { name: 'PRO canceled', status: PRO_CANCELED }
    ])(
      '$name: the payment portal returns the server URL for the host to open',
      async ({ status }) => {
        const h = harness({
          status,
          script: {
            [POST_PORTAL]: [
              http(200, { url: 'https://billing.example/portal' })
            ]
          }
        })

        const result = await h.commands.openPaymentPortal({
          returnUrl: 'https://app.example/return'
        })

        expect(result).toEqual({
          status: 'ok',
          value: { url: 'https://billing.example/portal' }
        })
        expect(h.posts()).toEqual([
          expect.objectContaining({
            route: PAYMENT_PORTAL_ROUTE,
            body: { return_url: 'https://app.example/return' }
          })
        ])
        expect(h.posts()[0]?.idempotencyKey).toBeUndefined()
        expect(h.invalidate).not.toHaveBeenCalled()
      }
    )

    it('reports a 401 the transport could not replay as transient, not as a denial', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: {
          [POST_PORTAL]: [http(401, {}, { authenticationRetrySkipped: true })]
        }
      })

      await expect(h.commands.openPaymentPortal({})).resolves.toEqual({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 401
      })
    })

    it('refuses a portal URL that is not https', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: {
          [POST_PORTAL]: [http(200, { url: 'javascript:alert(1)' })]
        }
      })

      await expect(h.commands.openPaymentPortal({})).resolves.toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
    })
  })

  describe('preview', () => {
    const PREVIEW_PLAN = {
      credits_cents: 2000,
      duration: 'MONTHLY',
      price_cents: 2000,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2000,
        total_credits_cents: 2000
      },
      slug: 'pro-monthly',
      tier: 'PRO'
    }
    const QUOTE_BODY = {
      allowed: true,
      cost_next_period_cents: 2000,
      cost_today_cents: 1500,
      credits_next_period_cents: 2000,
      credits_today_cents: 1500,
      effective_at: '2026-09-15T00:00:00.000Z',
      is_immediate: true,
      new_plan: PREVIEW_PLAN,
      transition_type: 'upgrade'
    }
    const quote = http(200, QUOTE_BODY)

    it('decodes the quote and sends every field snake_cased without an idempotency key', async () => {
      const h = harness({ status: FREE, script: { [POST_PREVIEW]: [quote] } })

      const result = await h.commands.previewSubscribe({
        planSlug: 'pro-monthly',
        promotionCode: 'LAUNCH',
        teamCreditStopId: 'stop-1',
        checkoutAttemptId: 'attempt-1'
      })

      expect(result).toMatchObject({
        status: 'ok',
        value: {
          allowed: true,
          cost_today_cents: 1500,
          new_plan: { slug: 'pro-monthly', price_cents: 2000 },
          transition_type: 'upgrade'
        }
      })
      expect(h.posts()).toEqual([
        expect.objectContaining({
          route: PREVIEW_SUBSCRIBE_ROUTE,
          body: {
            plan_slug: 'pro-monthly',
            promotion_code: 'LAUNCH',
            team_credit_stop_id: 'stop-1',
            checkout_attempt_id: 'attempt-1'
          }
        })
      ])
      expect(h.posts()[0]?.idempotencyKey).toBeUndefined()
    })

    it("keeps the server's credit counts, which converting the cents can miss by one", async () => {
      const granted = http(200, {
        ...QUOTE_BODY,
        credits_today_cents: 1991,
        credits_next_period_cents: 1991,
        credits_today: 4200,
        credits_next_period: 4200
      })
      const h = harness({ status: FREE, script: { [POST_PREVIEW]: [granted] } })

      const result = await h.commands.previewSubscribe({
        planSlug: 'pro-monthly'
      })

      expect(result).toMatchObject({
        status: 'ok',
        value: { credits_today: 4200, credits_next_period: 4200 }
      })
    })

    it.for([
      ['a fraction of a credit', 'credits_today', 4200.5],
      ['a fraction of a credit', 'credits_next_period', 4200.5],
      ['a negative count', 'credits_today', -1],
      ['a negative count', 'credits_next_period', -1]
    ] as const)('refuses %s at %s', async ([, field, count]) => {
      const h = harness({
        status: FREE,
        script: {
          [POST_PREVIEW]: [http(200, { ...QUOTE_BODY, [field]: count })]
        }
      })

      await expect(
        h.commands.previewSubscribe({ planSlug: 'pro-monthly' })
      ).resolves.toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
    })

    it('hands the applied discounts back, echoing the promotion code it sent', async () => {
      const discounted = http(200, {
        ...QUOTE_BODY,
        discounts: [
          {
            amount_off_cents: 500,
            code: 'LAUNCH',
            kind: 'promotion',
            name: 'Launch offer'
          },
          { code: 'pro-annual-bundle', kind: 'plan' }
        ],
        promotion_code: 'LAUNCH'
      })
      const h = harness({
        status: FREE,
        script: { [POST_PREVIEW]: [discounted] }
      })

      const result = await h.commands.previewSubscribe({
        planSlug: 'pro-monthly',
        promotionCode: 'LAUNCH'
      })

      expect(result).toEqual({
        status: 'ok',
        value: expect.objectContaining({
          discounts: [
            {
              amount_off_cents: 500,
              code: 'LAUNCH',
              kind: 'promotion',
              name: 'Launch offer'
            },
            { code: 'pro-annual-bundle', kind: 'plan' }
          ],
          promotion_code: 'LAUNCH'
        })
      })
    })

    it('hands back the server-reported subtotal, list price, discount term and applied balance as numbers', async () => {
      const itemized = http(200, {
        ...QUOTE_BODY,
        subtotal_cents: 2000,
        balance_applied_cents: 300,
        new_plan: { ...PREVIEW_PLAN, list_price_cents: 2500 },
        discounts: [
          {
            amount_off_cents: 500,
            code: 'LAUNCH',
            kind: 'promotion',
            duration: 'repeating',
            duration_in_months: 3
          }
        ]
      })
      const h = harness({
        status: FREE,
        script: { [POST_PREVIEW]: [itemized] }
      })

      const result = await h.commands.previewSubscribe({
        planSlug: 'pro-monthly'
      })

      expect(result).toEqual({
        status: 'ok',
        value: expect.objectContaining({
          subtotal_cents: 2000,
          balance_applied_cents: 300,
          new_plan: expect.objectContaining({ list_price_cents: 2500 }),
          discounts: [
            {
              amount_off_cents: 500,
              code: 'LAUNCH',
              kind: 'promotion',
              duration: 'repeating',
              duration_in_months: 3
            }
          ]
        })
      })
    })

    it('omits the optional fields the caller left out, issuing no operation', async () => {
      const h = harness({ status: FREE, script: { [POST_PREVIEW]: [quote] } })

      await h.commands.previewSubscribe({ planSlug: 'pro-monthly' })

      expect(h.posts()[0]?.body).toEqual({ plan_slug: 'pro-monthly' })
      expect(h.lifecycle.getSnapshot()).toEqual([])
      expect(h.invalidate).not.toHaveBeenCalled()
      expect(h.status.read).not.toHaveBeenCalled()
    })

    it('rejects a preview without a plan slug before any request', async () => {
      const h = harness({ status: FREE })

      // @ts-expect-error a preview without a plan slug does not type-check either
      const result = await h.commands.previewSubscribe({})

      expect(result).toEqual({ status: 'error', code: 'INVALID_REQUEST' })
      expect(h.calls).toEqual([])
    })

    it.for([
      {
        name: 'a 401 the transport could not replay is transient',
        answer: http(401, {}, { authenticationRetrySkipped: true }),
        httpStatus: 401,
        code: 'REQUEST_FAILED'
      },
      {
        name: 'a 401 it did replay is a denial',
        answer: http(401),
        httpStatus: 401,
        code: 'ACCESS_DENIED'
      },
      {
        name: 'a 403 is a denial',
        answer: http(403),
        httpStatus: 403,
        code: 'ACCESS_DENIED'
      },
      {
        name: 'a 404 is not found',
        answer: http(404),
        httpStatus: 404,
        code: 'NOT_FOUND'
      },
      {
        name: 'a 409 is a conflict',
        answer: http(409),
        httpStatus: 409,
        code: 'CONFLICT'
      },
      {
        name: 'a 5xx is transient',
        answer: http(500),
        httpStatus: 500,
        code: 'REQUEST_FAILED'
      }
    ])('$name', async ({ answer, httpStatus, code }) => {
      const h = harness({ status: FREE, script: { [POST_PREVIEW]: [answer] } })

      await expect(
        h.commands.previewSubscribe({ planSlug: 'pro-monthly' })
      ).resolves.toEqual({ status: 'error', code, httpStatus })
    })

    it('reports a 2xx outside the generated contract as MALFORMED_RESPONSE', async () => {
      const h = harness({
        status: FREE,
        script: { [POST_PREVIEW]: [http(200, { allowed: true })] }
      })

      await expect(
        h.commands.previewSubscribe({ planSlug: 'pro-monthly' })
      ).resolves.toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
    })

    const QUOTE_CENT_FIELDS = [
      'amount_due_cents',
      'cost_next_period_cents',
      'cost_today_cents',
      'credits_next_period_cents',
      'credits_today_cents',
      'renewal_amount_cents',
      'subtotal_cents',
      'balance_applied_cents',
      'proration_remaining_cents',
      'proration_unused_cents'
    ] as const satisfies readonly (keyof SubscriptionPreview)[]

    const PLAN_CENT_FIELDS = [
      'credits_cents',
      'price_cents',
      'list_price_cents',
      'monthly_list_price_cents',
      'monthly_price_cents'
    ] as const satisfies readonly (keyof SubscriptionPreview['new_plan'])[]

    const SEAT_CENT_FIELDS = [
      'total_cost_cents',
      'total_credits_cents'
    ] as const satisfies readonly (keyof SubscriptionPreview['new_plan']['seat_summary'])[]

    type PreviewDiscount = NonNullable<SubscriptionPreview['discounts']>[number]

    const DISCOUNT_CENT_FIELDS = [
      'amount_off_cents',
      'duration_in_months'
    ] as const satisfies readonly (keyof PreviewDiscount)[]

    // Compile-time pins: an amount a regen adds fails the package typecheck
    // until it reaches a row below.
    expectTypeOf<(typeof QUOTE_CENT_FIELDS)[number]>().toEqualTypeOf<
      Extract<keyof SubscriptionPreview, `${string}_cents`>
    >()
    expectTypeOf<(typeof PLAN_CENT_FIELDS)[number]>().toEqualTypeOf<
      Extract<keyof SubscriptionPreview['new_plan'], `${string}_cents`>
    >()
    expectTypeOf<(typeof SEAT_CENT_FIELDS)[number]>().toEqualTypeOf<
      Extract<
        keyof SubscriptionPreview['new_plan']['seat_summary'],
        `${string}_cents`
      >
    >()
    expectTypeOf<(typeof DISCOUNT_CENT_FIELDS)[number]>().toEqualTypeOf<
      Extract<keyof PreviewDiscount, `${string}_cents` | `${string}_in_months`>
    >()

    const rejectsQuote = async (patch: object) => {
      const h = harness({
        status: FREE,
        script: { [POST_PREVIEW]: [http(200, { ...QUOTE_BODY, ...patch })] }
      })

      await expect(
        h.commands.previewSubscribe({ planSlug: 'pro-monthly' })
      ).resolves.toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
    }

    const FRACTION_OF_A_CENT = 1500.5

    it.for(QUOTE_CENT_FIELDS)('refuses a fraction of a cent at %s', (field) =>
      rejectsQuote({ [field]: FRACTION_OF_A_CENT })
    )

    it.for(PLAN_CENT_FIELDS)(
      'refuses a fraction of a cent at new_plan.%s',
      (field) =>
        rejectsQuote({
          new_plan: { ...PREVIEW_PLAN, [field]: FRACTION_OF_A_CENT }
        })
    )

    it.for(PLAN_CENT_FIELDS)(
      'refuses a fraction of a cent at current_plan.%s',
      (field) =>
        rejectsQuote({
          current_plan: { ...PREVIEW_PLAN, [field]: FRACTION_OF_A_CENT }
        })
    )

    it.for(SEAT_CENT_FIELDS)(
      'refuses a fraction of a cent at new_plan.seat_summary.%s',
      (field) =>
        rejectsQuote({
          new_plan: {
            ...PREVIEW_PLAN,
            seat_summary: {
              ...PREVIEW_PLAN.seat_summary,
              [field]: FRACTION_OF_A_CENT
            }
          }
        })
    )

    it.for(DISCOUNT_CENT_FIELDS)(
      'refuses a fraction of a cent at discounts[].%s',
      (field) =>
        rejectsQuote({
          discounts: [
            {
              code: 'LAUNCH',
              kind: 'promotion',
              name: 'Launch offer',
              [field]: FRACTION_OF_A_CENT
            }
          ]
        })
    )

    it.for([
      ['past the safe integers', Number.MAX_SAFE_INTEGER + 2],
      ['with no finite value at all', Number.POSITIVE_INFINITY]
    ] as const)('refuses an amount %s', ([, cents]) =>
      rejectsQuote({ cost_today_cents: cents })
    )

    it('forwards the caller signal and timeout, releasing an abandoned read as transient', async () => {
      const controller = new AbortController()
      const h = harness({
        status: FREE,
        script: {
          [POST_PREVIEW]: [{ status: 'error', code: 'REQUEST_FAILED' }]
        }
      })
      controller.abort()

      await expect(
        h.commands.previewSubscribe(
          { planSlug: 'pro-monthly' },
          { signal: controller.signal, timeoutMs: 5_000 }
        )
      ).resolves.toEqual({ status: 'error', code: 'REQUEST_FAILED' })
      expect(h.posts()[0]).toMatchObject({
        signal: controller.signal,
        timeoutMs: 5_000
      })
    })
  })

  describe('saved payment method', () => {
    it('sends the saved payment method alone and drops an empty confirmation token', async () => {
      const h = harness({
        status: FREE,
        script: { [POST_SUBSCRIBE]: [subscribed], [GET_OP]: settledOk }
      })

      await h.commands.subscribe({
        ...PLAN,
        saved_payment_method_id: 'pm_123',
        confirmation_token: ''
      })

      expect(h.posts()[0]?.body).toEqual({
        plan_slug: 'pro-monthly',
        saved_payment_method_id: 'pm_123',
        idempotency_key: 'key-1'
      })
    })

    it('sends the confirmation token alone and drops an empty saved payment method', async () => {
      const h = harness({
        status: FREE,
        script: { [POST_SUBSCRIBE]: [subscribed], [GET_OP]: settledOk }
      })

      await h.commands.subscribe({
        ...PLAN,
        saved_payment_method_id: '',
        confirmation_token: 'ctoken_123'
      })

      expect(h.posts()[0]?.body).toEqual({
        plan_slug: 'pro-monthly',
        confirmation_token: 'ctoken_123',
        idempotency_key: 'key-1'
      })
    })

    it('rejects both credentials before any request', async () => {
      const h = harness({ status: FREE })

      const result = await h.commands.subscribe({
        ...PLAN,
        saved_payment_method_id: 'pm_123',
        confirmation_token: 'ctoken_123'
      })

      expect(result).toEqual({
        status: 'error',
        code: 'CONFLICTING_PAYMENT_METHOD'
      })
      expect(h.calls).toEqual([])
      expect(h.status.read).not.toHaveBeenCalled()
    })

    it('rejects a request the generated schema refuses before any request', async () => {
      const h = harness({ status: FREE })

      const result = await h.commands.subscribe({
        ...PLAN,
        saved_payment_method_id: 'card_123'
      })

      expect(result).toEqual({ status: 'error', code: 'INVALID_REQUEST' })
      expect(h.calls).toEqual([])
    })
  })

  describe('customer action', () => {
    it('drives a required 3DS challenge through driveEmbeddedChallenge to success', async () => {
      const h = harness({
        status: FREE,
        embedded: true,
        script: {
          [POST_SUBSCRIBE]: [pendingPayment],
          [GET_OP]: [
            http(
              200,
              opStatus({
                authentication_state: 'requires_action',
                payment_intent_client_secret: 'pi_secret'
              })
            ),
            ...settledOk
          ]
        }
      })
      const handleNextAction = vi.fn(async () => ({
        paymentIntent: { status: 'processing' }
      }))

      const result = h.commands.subscribe({
        ...PLAN,
        confirmation_token: 'ctoken_123'
      })
      await flush()
      expect(h.lifecycle.get('op-1')).toMatchObject({
        presentation: 'embedded',
        challenge: { clientSecret: 'pi_secret', status: 'required' }
      })

      await expect(
        driveEmbeddedChallenge(h.lifecycle, 'op-1', { handleNextAction })
      ).resolves.toBe('completed')
      expect(handleNextAction).toHaveBeenCalledWith('pi_secret')

      await expect(result).resolves.toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded' }
      })
      expect(h.calls.filter((call) => call.method === 'GET')).toHaveLength(2)
    })

    it('hands the hosted payment page to the lifecycle as the action url', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [
            http(200, {
              billing_op_id: 'op-1',
              status: 'needs_payment_method',
              payment_method_url: 'https://checkout.example/pay'
            })
          ],
          [GET_OP]: [
            http(200, opStatus({ action_url: 'https://checkout.example/pay' })),
            ...settledOk
          ]
        }
      })

      const result = h.commands.subscribe(PLAN)
      await flush()
      expect(h.lifecycle.get('op-1')).toMatchObject({
        phase: 'pending',
        presentation: 'hosted',
        actionUrl: 'https://checkout.example/pay',
        customerActionSeen: true
      })

      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs)
      await expect(result).resolves.toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded' }
      })
    })

    it.for([
      ['subscribed', subscribed],
      ['pending_payment', pendingPayment],
      [
        'needs_payment_method',
        http(200, {
          billing_op_id: 'op-1',
          status: 'needs_payment_method',
          payment_method_url: 'https://checkout.example/pay'
        })
      ]
    ] as const)(
      'settles a %s subscribe under the status the server issued it with',
      async ([issuedStatus, response]) => {
        const h = harness({
          status: FREE,
          script: { [POST_SUBSCRIBE]: [response], [GET_OP]: settledOk }
        })

        const result = h.commands.subscribe(PLAN)
        await flush()
        await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs)

        await expect(result).resolves.toMatchObject({
          status: 'ok',
          value: { phase: 'succeeded', issuedStatus }
        })
      }
    )

    it('leaves a cancel without an issued subscribe status', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: {
          [POST_CANCEL]: [
            http(200, {
              billing_op_id: 'op-1',
              cancel_at: '2026-10-01T00:00:00.000Z'
            })
          ],
          [GET_OP]: settledOk
        }
      })

      const result = await h.commands.cancelSubscription()

      assert(result.status === 'ok')
      expect(result.value.issuedStatus).toBeUndefined()
    })

    it('reports a hosted payment step without a page as MISSING_PAYMENT_METHOD_URL', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [
            http(200, { billing_op_id: 'op-1', status: 'needs_payment_method' })
          ]
        }
      })

      await expect(h.commands.subscribe(PLAN)).resolves.toEqual({
        status: 'error',
        code: 'MISSING_PAYMENT_METHOD_URL'
      })
      expect(h.lifecycle.get('op-1')).toBeUndefined()
    })
  })

  describe('declines', () => {
    it('settles a declined attempt with the coded reason and never the server text', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [pendingPayment],
          [GET_OP]: [
            http(
              200,
              opStatus({
                status: 'failed',
                decline_reason: 'insufficient_funds',
                recovery_action: 'replace_payment_method',
                error_message: SERVER_TEXT
              })
            )
          ]
        }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toMatchObject({
        status: 'ok',
        value: {
          phase: 'failed',
          operation: {
            declineReason: 'insufficient_funds',
            recoveryAction: 'replace_payment_method'
          }
        }
      })
      expect(JSON.stringify(result)).not.toContain('Stripe')
      expect(h.invalidate).not.toHaveBeenCalled()
      expect(h.readCredits).not.toHaveBeenCalled()
    })

    it.for([
      { httpStatus: 400, expected: 'QUOTE_STALE' },
      { httpStatus: 503, expected: 'REQUEST_FAILED' }
    ])(
      'a subscribe answered $httpStatus SUBSCRIPTION_QUOTE_STALE is $expected',
      async ({ httpStatus, expected }) => {
        const h = harness({
          status: FREE,
          script: {
            [POST_SUBSCRIBE]: [
              serverError(httpStatus, 'SUBSCRIPTION_QUOTE_STALE')
            ]
          }
        })

        await expect(h.commands.subscribe(PLAN)).resolves.toMatchObject({
          status: 'error',
          code: expected
        })
      }
    )

    it('surfaces REACTIVATION_CONFIRMATION_REQUIRED for the host to re-preview', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [
            serverError(409, 'REACTIVATION_CONFIRMATION_REQUIRED')
          ]
        }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toEqual({
        status: 'error',
        code: 'REACTIVATION_CONFIRMATION_REQUIRED'
      })
      expect(JSON.stringify(result)).not.toContain('Stripe')
    })
  })

  describe('cancellation', () => {
    it('settles a cancellation the server only accepted, reading cancel_at from status afterwards', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: {
          [POST_CANCEL]: [
            http(200, { billing_op_id: 'op-1', status: 'pending' })
          ],
          [GET_OP]: [http(200, opStatus()), ...settledOk]
        }
      })

      const result = h.commands.cancelSubscription()
      await flush()
      expect(h.lifecycle.get('op-1')).toMatchObject({
        kind: 'cancel',
        phase: 'pending'
      })
      h.status.answer(statusSnapshot(PRO_CANCELED))
      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.initialMs * 1.5)

      await expect(result).resolves.toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded' }
      })
      expect(h.status.read).toHaveBeenLastCalledWith()
      expect(h.status.read).toHaveBeenCalledTimes(2)
    })

    it('does not treat a 5xx echoing ALREADY_CANCELED as already canceled', async () => {
      const h = harness({
        status: PRO_ACTIVE,
        script: { [POST_CANCEL]: [serverError(502, 'ALREADY_CANCELED')] }
      })

      await expect(h.commands.cancelSubscription()).resolves.toEqual({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 502,
        serverCode: 'ALREADY_CANCELED',
        serverMessage: SERVER_TEXT
      })
      expect(h.invalidate).not.toHaveBeenCalled()
    })
  })

  describe('cancelOperation', () => {
    it.for([
      {
        answer: http(200, { billing_op_id: 'op-1', status: 'canceled' }),
        result: { status: 'canceled' }
      },
      {
        answer: http(202, {
          billing_op_id: 'op-1',
          status: 'cancel_requested'
        }),
        result: { status: 'cancel_requested' }
      },
      {
        answer: serverError(409, 'NOT_CANCELABLE'),
        result: {
          status: 'not_canceled',
          code: 'NOT_CANCELABLE',
          serverMessage: SERVER_TEXT
        }
      },
      {
        answer: serverError(409, 'PAYMENT_IN_FLIGHT'),
        result: {
          status: 'not_canceled',
          code: 'PAYMENT_IN_FLIGHT',
          serverMessage: SERVER_TEXT
        }
      },
      {
        answer: serverError(404, 'NOT_FOUND'),
        result: { status: 'error', code: 'NOT_FOUND', httpStatus: 404 }
      },
      {
        answer: serverError(502, 'PAYMENT_IN_FLIGHT'),
        result: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 502 }
      },
      {
        answer: http(200, { billing_op_id: 'op-1', status: 'charged' }),
        result: { status: 'error', code: 'MALFORMED_RESPONSE' }
      }
    ])(
      'answers $result.status ($result.code) for a $answer.value.httpStatus',
      async ({ answer, result }) => {
        const h = harness({
          status: PRO_ACTIVE,
          script: { [POST_CANCEL_OP]: [answer] }
        })

        await expect(h.commands.cancelOperation('op-1')).resolves.toMatchObject(
          result
        )
        expect(h.posts()).toEqual([
          expect.objectContaining({ route: cancelOperationRoute('op-1') })
        ])
      }
    )

    it('reads the followed operation back at once after the server cancels it', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [pendingPayment],
          [POST_CANCEL_OP]: [
            http(200, { billing_op_id: 'op-1', status: 'canceled' })
          ],
          [GET_OP]: [
            http(200, opStatus({ authentication_state: 'requires_action' })),
            http(
              200,
              opStatus({
                status: 'failed',
                decline_reason: 'authentication_failed'
              })
            )
          ]
        }
      })
      const subscribed = h.commands.subscribe(PLAN)
      await flush()
      expect(h.lifecycle.get('op-1')).toMatchObject({ phase: 'pending' })

      await h.commands.cancelOperation('op-1')
      await flush()

      expect(h.lifecycle.get('op-1')).toMatchObject({ phase: 'failed' })
      await expect(subscribed).resolves.toMatchObject({
        status: 'ok',
        value: { phase: 'failed' }
      })
    })
  })

  describe('unexpected errors', () => {
    it('passes a transport failure through without adopting anything', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [{ status: 'error', code: 'REQUEST_FAILED' }]
        }
      })

      await expect(h.commands.subscribe(PLAN)).resolves.toEqual({
        status: 'error',
        code: 'REQUEST_FAILED'
      })
      expect(h.lifecycle.getSnapshot()).toEqual([])
    })

    it('reports a 2xx outside the generated contract as MALFORMED_RESPONSE', async () => {
      const h = harness({
        status: FREE,
        script: { [POST_SUBSCRIBE]: [http(200, { status: 'subscribed' })] }
      })

      await expect(h.commands.subscribe(PLAN)).resolves.toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
    })

    it('reports a 5xx as REQUEST_FAILED with the server code and message', async () => {
      const h = harness({
        status: PRO_CANCELED,
        script: { [POST_RESUBSCRIBE]: [serverError(500, 'INTERNAL')] }
      })

      const result = await h.commands.resubscribe()

      expect(result).toEqual({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 500,
        serverCode: 'INTERNAL',
        serverMessage: SERVER_TEXT
      })
    })

    it('does not issue when the eligibility read fails', async () => {
      const h = harness({ status: FREE })
      h.status.answer({ status: 'error', code: 'ACCESS_DENIED' })

      await expect(h.commands.subscribe(PLAN)).resolves.toEqual({
        status: 'error',
        code: 'ACCESS_DENIED'
      })
      expect(h.calls).toEqual([])
    })
  })

  describe('reconciliation', () => {
    it('settles as reconciliation_needed when the server cannot find the operation', async () => {
      const h = harness({
        status: FREE,
        script: { [POST_SUBSCRIBE]: [pendingPayment], [GET_OP]: [http(404)] }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toMatchObject({
        status: 'ok',
        value: {
          phase: 'reconciliation_needed',
          operation: { id: 'op-1', phase: 'reconciliation_needed' }
        }
      })
      expect(h.invalidate).not.toHaveBeenCalled()
    })
  })

  describe('through the lifecycle', () => {
    // The pending operation carries no plan, so joining it would settle a plan
    // the caller never asked for and report it as this subscribe's success.
    it.for([
      ['offering a hosted action', 'https://checkout.example/pay'],
      ['offering none yet', undefined]
    ] as const)(
      'refuses a subscribe over a pending operation it did not issue, %s',
      async ([, actionUrl]) => {
        const h = harness({
          status: {
            ...FREE,
            pending_billing_op_id: 'op-1',
            pending_billing_op_type: 'subscription',
            ...(actionUrl === undefined ? {} : { action_url: actionUrl })
          },
          script: { [GET_OP]: settledOk }
        })

        const result = await h.commands.subscribe(PLAN)

        expect(result).toEqual({
          status: 'error',
          code: 'OPERATION_ALREADY_PENDING'
        })
        expect(h.posts()).toEqual([])
        expect(h.invalidate).not.toHaveBeenCalled()
      }
    )

    describe('over a checkout this tab recovered parked on the server', () => {
      const PARKED = {
        ...FREE,
        pending_billing_op_id: 'op-1',
        pending_billing_op_type: 'subscription'
      } as const

      async function recoveredAt(
        phase: BillingOpStatus['phase'],
        subscribeAnswer: BillingResult<BillingHttpResponse>
      ) {
        const h = harness({
          status: PARKED,
          script: {
            [GET_OP]: [http(200, opStatus({ phase }))],
            [`GET ${operationRoute('op-2')}`]: [
              http(200, opStatus({ id: 'op-2' }))
            ],
            [POST_SUBSCRIBE]: [subscribeAnswer]
          }
        })
        await h.lifecycle.recover()
        await flush()
        return h
      }

      it('sends the subscribe the server resumes a card-less checkout with', async () => {
        const h = await recoveredAt(
          'awaiting_payment_method',
          http(200, {
            billing_op_id: 'op-1',
            status: 'needs_payment_method',
            payment_method_url: 'https://checkout.example/resumed'
          })
        )

        void h.commands.subscribe(PLAN)
        await flush()

        expect(h.posts()).toHaveLength(1)
        expect(h.lifecycle.get('op-1')).toMatchObject({
          phase: 'pending',
          actionUrl: 'https://checkout.example/resumed'
        })
      })

      it('resolves the recovered checkout before deciding, so a click before its first read still resumes it', async () => {
        const h = harness({
          status: PARKED,
          script: {
            [GET_OP]: [
              new Promise<never>(() => {}),
              http(200, opStatus({ phase: 'awaiting_payment_method' }))
            ],
            [POST_SUBSCRIBE]: [
              http(200, {
                billing_op_id: 'op-1',
                status: 'needs_payment_method',
                payment_method_url: 'https://checkout.example/resumed'
              })
            ]
          }
        })
        await h.lifecycle.recover()

        void h.commands.subscribe(PLAN)
        await flush()

        expect(h.posts()).toHaveLength(1)
      })

      it('stops watching the checkout the server replaced with a new one', async () => {
        const h = await recoveredAt(
          'awaiting_payment_method',
          http(200, { billing_op_id: 'op-2', status: 'pending_payment' })
        )

        void h.commands.subscribe(PLAN)
        await flush()

        expect(h.lifecycle.get('op-1')?.phase).toBe('superseded')
        expect(h.lifecycle.get('op-2')?.phase).toBe('pending')
      })

      it('still refuses over an invoice waiting on the customer', async () => {
        const h = await recoveredAt(
          'awaiting_invoice_payment',
          http(200, { billing_op_id: 'op-2', status: 'pending_payment' })
        )

        await expect(h.commands.subscribe(PLAN)).resolves.toEqual({
          status: 'error',
          code: 'OPERATION_ALREADY_PENDING'
        })
        expect(h.posts()).toEqual([])
      })
    })

    it('settles as timed_out when the poll budget runs out', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [pendingPayment],
          [GET_OP]: [http(200, opStatus())]
        }
      })

      const result = h.commands.subscribe(PLAN)
      await vi.advanceTimersByTimeAsync(
        OPERATION_POLL_BUDGET.subscriptionDiscoveryMs +
          OPERATION_POLL_TIMING.maxMs
      )

      await expect(result).resolves.toMatchObject({
        status: 'ok',
        value: { phase: 'timed_out' }
      })
      expect(h.invalidate).not.toHaveBeenCalled()
    })

    it('settles as superseded when the workspace changes mid-operation', async () => {
      const h = harness({
        status: FREE,
        script: {
          [POST_SUBSCRIBE]: [pendingPayment],
          [GET_OP]: [http(200, opStatus())]
        }
      })

      const result = h.commands.subscribe(PLAN)
      await flush()
      h.session.moveTo(
        authenticated(
          credential({
            workspace: { id: 'ws-2', name: 'Team', type: 'team' }
          })
        )
      )

      await expect(result).resolves.toMatchObject({
        status: 'ok',
        value: { phase: 'superseded' }
      })
      expect(h.invalidate).not.toHaveBeenCalled()
    })
  })
})
