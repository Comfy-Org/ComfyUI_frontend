/**
 * A `BillingClient` whose readers and commands answer from canned core
 * results. The hosted surfaces only project what the composables expose, so a
 * scripted client is enough here; the composables themselves are covered
 * against a real core in `@comfyorg/account-ui`.
 */
import { vi } from 'vitest'

import type {
  BillingPlansData,
  BillingResult,
  PaymentMethodsSnapshot,
  PlansSnapshot,
  PreviewSubscribeResult,
  SavedPaymentMethod,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { BillingClient } from '@comfyorg/account-ui/billing'

/** Nothing on these surfaces touches the rest of the client. */
function unusedByHostedSurfaces(member: string) {
  return () => {
    throw new Error(`fake billing client: ${member} is never called`)
  }
}

const SCOPE: PlansSnapshot['scope'] = {
  userId: 'uid-1',
  workspaceId: 'ws-1',
  role: 'owner'
}
const READ_AT = 1_700_000_000_000

export interface FakeBillingClientOptions {
  readonly plans?: BillingResult<BillingPlansData>
  readonly paymentMethods?: BillingResult<readonly SavedPaymentMethod[]>
  readonly preview?: PreviewSubscribeResult
  readonly portalUrl?: string
}

export interface FakeBillingClient {
  readonly client: BillingClient
  readonly readPlans: () => Promise<BillingResult<PlansSnapshot>>
  readonly readPaymentMethods: () => Promise<
    BillingResult<PaymentMethodsSnapshot>
  >
  readonly invalidatePaymentMethods: () => void
  readonly previewSubscribe: BillingClient['commands']['previewSubscribe']
  readonly openPaymentPortal: BillingClient['commands']['openPaymentPortal']
}

export function createFakeBillingClient(
  options: FakeBillingClientOptions = {}
): FakeBillingClient {
  const {
    plans = {
      status: 'ok',
      value: { current_plan_slug: undefined, plans: [] }
    },
    paymentMethods = { status: 'ok', value: [] },
    preview = { status: 'error', code: 'REQUEST_FAILED' },
    portalUrl = 'https://billing.stripe.test/session'
  } = options

  const readPlans = vi.fn(async () =>
    plans.status === 'ok'
      ? ({
          status: 'ok',
          value: { scope: SCOPE, data: plans.value, readAt: READ_AT }
        } satisfies BillingResult<PlansSnapshot>)
      : plans
  )
  const readPaymentMethods = vi.fn(async () =>
    paymentMethods.status === 'ok'
      ? ({
          status: 'ok',
          value: {
            scope: SCOPE,
            methods: paymentMethods.value,
            readAt: READ_AT
          }
        } satisfies BillingResult<PaymentMethodsSnapshot>)
      : paymentMethods
  )
  const invalidatePaymentMethods = vi.fn(() => {})
  const previewSubscribe = vi.fn(async () => preview)
  const openPaymentPortal = vi.fn(async () => ({
    status: 'ok' as const,
    value: { url: portalUrl }
  }))

  const client: BillingClient = {
    lifecycle: {
      begin: unusedByHostedSurfaces('lifecycle.begin'),
      recover: unusedByHostedSurfaces('lifecycle.recover'),
      wake: unusedByHostedSurfaces('lifecycle.wake'),
      switchPresentation: unusedByHostedSurfaces(
        'lifecycle.switchPresentation'
      ),
      reportChallengeStarted: unusedByHostedSurfaces(
        'lifecycle.reportChallengeStarted'
      ),
      reportChallengeSettled: unusedByHostedSurfaces(
        'lifecycle.reportChallengeSettled'
      ),
      get: unusedByHostedSurfaces('lifecycle.get'),
      getSnapshot: () => [],
      subscribe: () => () => {},
      settled: unusedByHostedSurfaces('lifecycle.settled'),
      dispose: () => {}
    },
    capabilities: {
      read: unusedByHostedSurfaces('capabilities.read'),
      getSnapshot: () => undefined,
      invalidate: () => {},
      dispose: () => {}
    },
    credits: {
      read: unusedByHostedSurfaces('credits.read'),
      getSnapshot: () => undefined,
      dispose: () => {}
    },
    status: {
      read: unusedByHostedSurfaces('status.read'),
      getSnapshot: () => undefined,
      dispose: () => {}
    },
    plans: {
      read: readPlans,
      getSnapshot: () => undefined,
      dispose: () => {}
    },
    paymentMethods: {
      read: readPaymentMethods,
      getSnapshot: () => undefined,
      invalidate: invalidatePaymentMethods,
      dispose: () => {}
    },
    topup: {
      createTopupCheckout: unusedByHostedSurfaces('topup.createTopupCheckout'),
      createHostedTopupCheckout: unusedByHostedSurfaces(
        'topup.createHostedTopupCheckout'
      )
    },
    commands: {
      subscribe: unusedByHostedSurfaces('commands.subscribe'),
      previewSubscribe,
      resubscribe: unusedByHostedSurfaces('commands.resubscribe'),
      cancelSubscription: unusedByHostedSurfaces('commands.cancelSubscription'),
      openPaymentPortal
    }
  }

  return {
    client,
    readPlans,
    readPaymentMethods,
    invalidatePaymentMethods,
    previewSubscribe,
    openPaymentPortal
  }
}

export function previewOf(
  overrides: Partial<SubscriptionPreview> = {}
): SubscriptionPreview {
  return {
    allowed: true,
    cost_today_cents: 2800n,
    cost_next_period_cents: 2800n,
    credits_today_cents: 6900n,
    credits_next_period_cents: 6900n,
    effective_at: '2026-10-01T00:00:00.000Z',
    is_immediate: true,
    transition_type: 'upgrade',
    new_plan: {
      credits_cents: 6900n,
      duration: 'MONTHLY',
      price_cents: 2800n,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2800n,
        total_credits_cents: 6900n
      },
      slug: 'creator_monthly',
      tier: 'CREATOR'
    },
    ...overrides
  }
}

export function planOf(
  overrides: Partial<BillingPlansData['plans'][number]> = {}
): BillingPlansData['plans'][number] {
  return {
    availability: { available: true },
    credits_cents: 6900n,
    duration: 'MONTHLY',
    max_seats: 1n,
    price_cents: 2800n,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 2800n,
      total_credits_cents: 6900n
    },
    slug: 'creator_monthly',
    tier: 'CREATOR',
    ...overrides
  }
}
