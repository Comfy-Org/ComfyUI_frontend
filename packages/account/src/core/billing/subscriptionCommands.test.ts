import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
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
import {
  CANCEL_SUBSCRIPTION_ROUTE,
  PAYMENT_PORTAL_ROUTE,
  RESUBSCRIBE_ROUTE,
  SUBSCRIBE_ROUTE,
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
    session: fake as SessionClient,
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
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
    session: session.session,
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
const GET_OP = `GET ${operationRoute('op-1')}`

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
  describe('eligibility from the status snapshot', () => {
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

    it('PRO active: subscribe is a no-op success without a request', async () => {
      const h = harness({ status: PRO_ACTIVE })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toEqual({ status: 'ok', value: { phase: 'succeeded' } })
      expect(h.calls).toEqual([])
      expect(h.invalidate).not.toHaveBeenCalled()
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

    it('PRO canceled: subscribe routes to the resubscribe endpoint', async () => {
      const h = harness({
        status: PRO_CANCELED,
        script: {
          [POST_RESUBSCRIBE]: [
            http(200, { billing_op_id: 'op-1', status: 'active' })
          ],
          [GET_OP]: settledOk
        }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded', operation: { kind: 'subscription' } }
      })
      expect(h.posts().map((call) => call.route)).toEqual([RESUBSCRIBE_ROUTE])
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
        serverCode: 'ALREADY_CANCELED'
      })
      expect(h.invalidate).not.toHaveBeenCalled()
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

    it('reports a 5xx as REQUEST_FAILED with the server code and never its message', async () => {
      const h = harness({
        status: PRO_CANCELED,
        script: { [POST_RESUBSCRIBE]: [serverError(500, 'INTERNAL')] }
      })

      const result = await h.commands.resubscribe()

      expect(result).toEqual({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 500,
        serverCode: 'INTERNAL'
      })
      expect(JSON.stringify(result)).not.toContain('Stripe')
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
    it("resumes the backend's pending subscription instead of issuing a second checkout", async () => {
      const h = harness({
        status: {
          ...FREE,
          pending_billing_op_id: 'op-1',
          pending_billing_op_type: 'subscription',
          action_url: 'https://checkout.example/pay'
        },
        script: { [GET_OP]: settledOk }
      })

      const result = await h.commands.subscribe(PLAN)

      expect(result).toMatchObject({
        status: 'ok',
        value: { phase: 'succeeded', operation: { id: 'op-1' } }
      })
      expect(h.posts()).toEqual([])
      expect(h.invalidate).toHaveBeenCalledOnce()
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
