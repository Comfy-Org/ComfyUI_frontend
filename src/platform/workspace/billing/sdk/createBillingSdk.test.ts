import type {
  BillingOperationTelemetryEvent,
  BillingResult,
  BillingSession
} from '@comfyorg/account-core/billing'
import {
  BILLING_STATUS_ROUTE,
  CAPABILITIES_ROUTE,
  CREDITS_ROUTE,
  PAYMENT_METHODS_ROUTE,
  PLANS_ROUTE,
  TOPUP_ROUTE,
  operationPointerKey,
  operationRoute
} from '@comfyorg/account-core/billing'
import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import type { BillingSdk, BillingSdkOptions } from './createBillingSdk'
import { createBillingSdk } from './createBillingSdk'

const BASE = 'https://cloud.test/api'

interface ScopedReader {
  read: () => Promise<BillingResult<unknown>>
  getSnapshot: () => unknown
}

const CREDENTIAL: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60 * 60 * 1000,
  uid: 'uid-1',
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: ['workspace:read']
}

const SNAPSHOT: SessionSnapshot = {
  phase: 'authenticated',
  user: { uid: 'uid-1', getIdToken: async () => 'id-token' },
  session: CREDENTIAL
}

const STATUS = {
  billing_rail: 'stripe',
  has_funds: true,
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null
}

const CAPABILITIES = {
  capabilities: {
    can_cancel: false,
    can_change_seats: false,
    can_downgrade_to_personal: false,
    can_invite_members: false,
    can_reactivate: false,
    can_subscribe_self_serve: false,
    can_top_up: true
  },
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
  revision: 42,
  rollout_defaults_applied: {
    can_downgrade_to_personal: false,
    can_subscribe_self_serve: false,
    can_top_up: false
  }
}

const PLANS = {
  current_plan_slug: 'free',
  plans: [
    {
      availability: { available: true },
      credits_cents: 2000,
      duration: 'MONTHLY',
      max_seats: 1,
      price_cents: 2000,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2000,
        total_credits_cents: 2000
      },
      slug: 'creator_monthly',
      tier: 'CREATOR'
    }
  ]
}

const PAYMENT_METHODS = [
  { brand: 'visa', id: 'pm_1', is_default: true, last4: '4242', type: 'card' }
]

const TOPUP_RESPONSE = {
  amount_cents: 1000,
  billing_op_id: 'op-1',
  status: 'pending',
  topup_id: 'topup-1'
}

function opStatus(overrides: Record<string, unknown>) {
  return { id: 'op-1', started_at: '2026-09-14T00:00:00.000Z', ...overrides }
}

function fakeSession() {
  const ensureFresh = vi.fn(async () => ({
    status: 'ok' as const,
    session: CREDENTIAL
  }))
  const session: BillingSession = {
    getSnapshot: () => SNAPSHOT,
    subscribe: () => () => {},
    ensureFresh,
    remint: ensureFresh
  }
  return { session, ensureFresh }
}

function fakeFetch() {
  const answers = new Map<string, () => unknown>()
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init: init ?? {} })
      const answer = answers.get(`${init?.method ?? 'GET'} ${url}`)
      if (!answer) return new Response('', { status: 404 })
      return new Response(JSON.stringify(answer()), { status: 200 })
    }
  )
  return {
    fetchImpl,
    calls,
    answer(method: 'GET' | 'POST', route: string, body: () => unknown) {
      answers.set(`${method} ${BASE}${route}`, body)
    }
  }
}

function harness(overrides: Partial<BillingSdkOptions> = {}) {
  const { session, ensureFresh } = fakeSession()
  const { fetchImpl, calls, answer } = fakeFetch()
  const storage = new Map<string, string>()
  const events: BillingOperationTelemetryEvent[] = []
  let balance = 1_000_000
  let operation: Record<string, unknown> = opStatus({ status: 'pending' })

  answer('GET', CAPABILITIES_ROUTE, () => CAPABILITIES)
  answer('GET', BILLING_STATUS_ROUTE, () => STATUS)
  answer('GET', PLANS_ROUTE, () => PLANS)
  answer('GET', PAYMENT_METHODS_ROUTE, () => PAYMENT_METHODS)
  answer('GET', CREDITS_ROUTE, () => ({
    amount_micros: balance,
    currency: 'USD'
  }))
  answer('POST', TOPUP_ROUTE, () => {
    balance = 2_000_000
    return TOPUP_RESPONSE
  })
  answer('GET', operationRoute('op-1'), () => operation)

  const sdk = createBillingSdk({
    session,
    resolveUrl: (route) => `${BASE}${route}`,
    workspaceId: () => 'ws-1',
    pointerStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
      removeItem: (key) => void storage.delete(key)
    },
    embeddedCheckoutAvailable: () => false,
    hostedDestination: () => 'stripe',
    onTelemetry: (event) => events.push(event),
    challengePort: async () => undefined,
    fetchImpl,
    ...overrides
  })
  onTestFinished(() => sdk.dispose())

  return {
    sdk,
    ensureFresh,
    calls,
    storage,
    events,
    settle(status: 'succeeded' | 'failed') {
      operation = opStatus({ status })
    },
    requireChallenge() {
      operation = opStatus({
        status: 'pending',
        authentication_state: 'requires_action',
        payment_intent_client_secret: 'pi_secret'
      })
    }
  }
}

describe('createBillingSdk', () => {
  it('runs a top-up over the app session and URL resolver and reports through the host ports', async () => {
    const { sdk, ensureFresh, calls, storage, events, settle } = harness()
    settle('succeeded')

    const result = await sdk.topup.createTopupCheckout({ amountCents: 1000 })

    expect(result).toMatchObject({ status: 'ok', creditsReconciled: true })
    const post = calls.find((call) => call.init.method === 'POST')
    expect(post?.url).toBe(`${BASE}${TOPUP_ROUTE}`)
    expect(post?.init.headers).toMatchObject({
      Authorization: 'Bearer workspace-jwt',
      'Idempotency-Key': expect.any(String)
    })
    expect(JSON.parse(String(post?.init.body))).toMatchObject({
      amount_cents: 1000
    })
    expect(ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'ws-1' })
    )
    expect(events.map((event) => event.name)).toEqual([
      'billing.operation.started',
      'billing.operation.succeeded'
    ])
    expect(storage.size).toBe(0)
  })

  it.for([
    { reader: 'status', select: (sdk: BillingSdk) => sdk.status },
    { reader: 'credits', select: (sdk: BillingSdk) => sdk.credits },
    { reader: 'capabilities', select: (sdk: BillingSdk) => sdk.capabilities },
    { reader: 'plans', select: (sdk: BillingSdk) => sdk.plans },
    {
      reader: 'paymentMethods',
      select: (sdk: BillingSdk) => sdk.paymentMethods
    }
  ])(
    'stops the $reader reader serving the disposed scope',
    async ({ select }) => {
      const { sdk } = harness()
      const reader: ScopedReader = select(sdk)
      await expect(reader.read()).resolves.toMatchObject({ status: 'ok' })

      sdk.dispose()

      expect(reader.getSnapshot()).toBeUndefined()
      await expect(reader.read()).resolves.toEqual({
        status: 'error',
        code: 'SUPERSEDED'
      })
    }
  )

  it('hands the host destination to the operation it routes hosted', async () => {
    const { sdk } = harness({ hostedDestination: () => 'billing_web' })

    void sdk.topup.createTopupCheckout({ amountCents: 1000 })

    await vi.waitFor(() =>
      expect(sdk.lifecycle.get('op-1')).toMatchObject({
        presentation: 'hosted',
        hostedDestination: 'billing_web'
      })
    )
  })

  it('keeps the tab pointer in the supplied storage while the operation is open', async () => {
    const { sdk, storage, requireChallenge } = harness()
    requireChallenge()

    void sdk.topup.createTopupCheckout({ amountCents: 1000 })
    await vi.waitFor(() =>
      expect(sdk.lifecycle.get('op-1')?.phase).toBe('pending')
    )

    expect(
      storage.get(
        operationPointerKey({
          userId: 'uid-1',
          workspaceId: 'ws-1',
          role: 'owner'
        })
      )
    ).toContain('"operationId":"op-1"')
  })

  it('drives a required challenge through the host port and reads the result back', async () => {
    const port = {
      handleNextAction: vi.fn(async () => ({
        paymentIntent: { status: 'succeeded' }
      }))
    }
    const { sdk, requireChallenge, settle } = harness({
      embeddedCheckoutAvailable: () => true,
      challengePort: async () => port
    })
    requireChallenge()
    const settled = sdk.topup.createTopupCheckout({ amountCents: 1000 })
    await vi.waitFor(() =>
      expect(sdk.lifecycle.get('op-1')).toMatchObject({
        presentation: 'embedded',
        challenge: { status: 'required' }
      })
    )

    settle('succeeded')
    await expect(sdk.driveChallenge('op-1')).resolves.toBe('completed')

    expect(port.handleNextAction).toHaveBeenCalledWith('pi_secret')
    await expect(settled).resolves.toMatchObject({ status: 'ok' })
  })

  it.for([
    { loader: 'resolves undefined', challengePort: async () => undefined },
    {
      loader: 'rejects',
      challengePort: async () => {
        throw new Error('payment provider script blocked')
      }
    }
  ])(
    'fails the challenge, not the operation, when the port loader $loader',
    async ({ challengePort }) => {
      const { sdk, requireChallenge } = harness({
        embeddedCheckoutAvailable: () => true,
        challengePort
      })
      requireChallenge()
      void sdk.topup.createTopupCheckout({ amountCents: 1000 })
      await vi.waitFor(() =>
        expect(sdk.lifecycle.get('op-1')).toMatchObject({
          challenge: { status: 'required' }
        })
      )

      await expect(sdk.driveChallenge('op-1')).resolves.toBe('failed')

      expect(sdk.lifecycle.get('op-1')).toMatchObject({
        phase: 'pending',
        authenticationState: 'failed_retryable'
      })
    }
  )
})
