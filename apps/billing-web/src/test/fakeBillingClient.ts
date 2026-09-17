/**
 * A `BillingClient` whose readers and commands answer from canned core
 * results. The hosted surfaces only project what the composables expose, so a
 * scripted client is enough here; the composables themselves are covered
 * against a real core in `@comfyorg/account-ui`. Operations a command or a
 * recovery produces are published to lifecycle subscribers the way the real
 * lifecycle would, so a view's projection over them is exercised for real.
 */
import { vi } from 'vitest'

import type {
  BillingDeclineReason,
  BillingOperationState,
  BillingPlansData,
  BillingResult,
  PaymentMethodsSnapshot,
  PaymentPortalResult,
  PlansSnapshot,
  PreviewSubscribeResult,
  SavedPaymentMethod,
  SubscriptionCommandResult,
  SubscriptionPreview,
  TerminalBillingOperation
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
  /** Overrides `portalUrl` when the portal itself should answer with a failure. */
  readonly portal?: PaymentPortalResult
  readonly subscribe?: SubscriptionCommandResult
  readonly recover?: BillingResult<BillingOperationState | undefined>
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
  readonly subscribe: BillingClient['commands']['subscribe']
  readonly recover: BillingClient['lifecycle']['recover']
  /** Publishes an operation as the lifecycle would after a poll. */
  readonly publishOperation: (state: BillingOperationState) => void
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
    portalUrl = 'https://billing.stripe.test/session',
    portal: portalOutcome = { status: 'ok', value: { url: portalUrl } },
    subscribe: subscribeOutcome = { status: 'error', code: 'REQUEST_FAILED' },
    recover: recoverOutcome = { status: 'ok', value: undefined }
  } = options

  const operations = new Map<string, BillingOperationState>()
  const listeners = new Set<(state: BillingOperationState) => void>()

  function publishOperation(state: BillingOperationState) {
    operations.set(state.id, state)
    for (const listener of listeners) listener(state)
  }

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
  const openPaymentPortal = vi.fn(async () => portalOutcome)
  const subscribe = vi.fn(async () => {
    if (subscribeOutcome.status === 'ok' && subscribeOutcome.value.operation) {
      publishOperation(subscribeOutcome.value.operation)
    }
    return subscribeOutcome
  })
  const recover = vi.fn(async () => {
    if (recoverOutcome.status === 'ok' && recoverOutcome.value) {
      publishOperation(recoverOutcome.value)
    }
    return recoverOutcome
  })

  const client: BillingClient = {
    lifecycle: {
      begin: unusedByHostedSurfaces('lifecycle.begin'),
      recover,
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
      get: (id) => operations.get(id),
      getSnapshot: () => [...operations.values()],
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
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
      subscribe,
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
    openPaymentPortal,
    subscribe,
    recover,
    publishOperation
  }
}

export function previewOf(
  overrides: Partial<SubscriptionPreview> = {}
): SubscriptionPreview {
  return {
    allowed: true,
    cost_today_cents: 2800,
    cost_next_period_cents: 2800,
    credits_today_cents: 6900,
    credits_next_period_cents: 6900,
    effective_at: '2026-10-01T00:00:00.000Z',
    is_immediate: true,
    transition_type: 'upgrade',
    new_plan: {
      credits_cents: 6900,
      duration: 'MONTHLY',
      price_cents: 2800,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2800,
        total_credits_cents: 6900
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

/** The identity every operation the fake publishes shares: this scope, embedded. */
function operationIdentity(id: string) {
  return {
    id,
    kind: 'subscription',
    scope: SCOPE,
    observedAt: READ_AT,
    attemptStartedAt: READ_AT,
    presentation: 'embedded'
  } as const
}

export function succeededOperation(id = 'op_1'): TerminalBillingOperation {
  return { ...operationIdentity(id), phase: 'succeeded' }
}

/** Pending with no continuation on offer: the lifecycle is still polling it. */
export function pendingOperation(id = 'op_1'): BillingOperationState {
  return {
    ...operationIdentity(id),
    phase: 'pending',
    customerActionSeen: false
  }
}

export function failedOperation(
  declineReason: BillingDeclineReason,
  id = 'op_1'
): TerminalBillingOperation {
  return {
    ...operationIdentity(id),
    phase: 'failed',
    declineReason,
    retryable: true
  }
}
