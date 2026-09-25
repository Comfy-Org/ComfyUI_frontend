/**
 * A `BillingClient` whose readers and commands answer from canned core
 * results. The hosted surfaces only project what the composables expose, so a
 * scripted client is enough here; the composables themselves are covered
 * against a real core in `@comfyorg/account-ui`. Operations a command or a
 * recovery produces are published to lifecycle subscribers the way the real
 * lifecycle would, so a view's projection over them is exercised for real.
 */
import type { Mock } from 'vitest'
import { vi } from 'vitest'

import type {
  BillingCapabilities,
  BillingDeclineReason,
  BillingOperationState,
  BillingPlansData,
  BillingResult,
  BillingStatusData,
  BillingStatusSnapshot,
  CapabilitiesSnapshot,
  PaymentMethodsSnapshot,
  PaymentPortalResult,
  PendingBillingOperation,
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
  readonly cancel?: SubscriptionCommandResult
  readonly resubscribe?: SubscriptionCommandResult
  readonly recover?: BillingResult<BillingOperationState | undefined>
  /** Every capability is denied unless named here. */
  readonly capabilities?: Partial<BillingCapabilities>
  readonly status?: BillingStatusData
}

export interface FakeBillingClient {
  readonly client: BillingClient
  readonly readPlans: () => Promise<BillingResult<PlansSnapshot>>
  readonly readPaymentMethods: () => Promise<
    BillingResult<PaymentMethodsSnapshot>
  >
  readonly invalidatePaymentMethods: () => void
  readonly previewSubscribe: Mock<BillingClient['commands']['previewSubscribe']>
  readonly reportChallengeStarted: Mock<
    BillingClient['lifecycle']['reportChallengeStarted']
  >
  readonly reportChallengeSettled: Mock<
    BillingClient['lifecycle']['reportChallengeSettled']
  >
  readonly openPaymentPortal: BillingClient['commands']['openPaymentPortal']
  /** A mock, so a test can script a sequence of answers for one attempt. */
  readonly subscribe: Mock<BillingClient['commands']['subscribe']>
  readonly cancelSubscription: Mock<
    BillingClient['commands']['cancelSubscription']
  >
  readonly resubscribe: Mock<BillingClient['commands']['resubscribe']>
  readonly recover: BillingClient['lifecycle']['recover']
  readonly readCapabilities: Mock<BillingClient['capabilities']['read']>
  readonly invalidateCapabilities: BillingClient['capabilities']['invalidate']
  readonly readStatus: Mock<BillingClient['status']['read']>
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
    cancel: cancelOutcome = { status: 'error', code: 'REQUEST_FAILED' },
    resubscribe: resubscribeOutcome = {
      status: 'error',
      code: 'REQUEST_FAILED'
    },
    recover: recoverOutcome = { status: 'ok', value: undefined },
    capabilities: granted = {},
    status = {
      is_active: true,
      has_funds: true,
      max_seats: 1,
      occupied_seats: 1,
      scheduled_change: null,
      team_credit_stop: null
    }
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
  const reportChallengeStarted: Mock<
    BillingClient['lifecycle']['reportChallengeStarted']
  > = vi.fn()
  const reportChallengeSettled: Mock<
    BillingClient['lifecycle']['reportChallengeSettled']
  > = vi.fn()
  const previewSubscribe = vi.fn(async () => preview)
  const openPaymentPortal = vi.fn(async () => portalOutcome)
  const subscribe = vi.fn(async () => {
    if (subscribeOutcome.status === 'ok' && subscribeOutcome.value.operation) {
      publishOperation(subscribeOutcome.value.operation)
    }
    return subscribeOutcome
  })
  function commandOf(outcome: SubscriptionCommandResult) {
    return vi.fn(async () => {
      if (outcome.status === 'ok' && outcome.value.operation) {
        publishOperation(outcome.value.operation)
      }
      return outcome
    })
  }
  const cancelSubscription = commandOf(cancelOutcome)
  const resubscribe = commandOf(resubscribeOutcome)
  const capabilitiesSnapshot: CapabilitiesSnapshot = {
    capabilities: {
      can_cancel: false,
      can_change_seats: false,
      can_downgrade_to_personal: false,
      can_invite_members: false,
      can_reactivate: false,
      can_subscribe_self_serve: false,
      can_top_up: false,
      ...granted
    },
    denials: {},
    rolloutDefaultsApplied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    revision: 1,
    scope: SCOPE,
    freshUntil: READ_AT + 60_000
  }
  const readCapabilities = vi.fn(async () => ({
    status: 'ok' as const,
    value: capabilitiesSnapshot
  }))
  const invalidateCapabilities = vi.fn(() => {})
  const readStatus: Mock<BillingClient['status']['read']> = vi.fn(async () => ({
    status: 'ok' as const,
    value: {
      status,
      scope: SCOPE,
      readAt: READ_AT
    } satisfies BillingStatusSnapshot
  }))
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
      reportChallengeStarted,
      reportChallengeSettled,
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
      read: readCapabilities,
      getSnapshot: () => undefined,
      invalidate: invalidateCapabilities,
      dispose: () => {}
    },
    credits: {
      read: unusedByHostedSurfaces('credits.read'),
      getSnapshot: () => undefined,
      dispose: () => {}
    },
    status: {
      read: readStatus,
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
    events: {
      read: unusedByHostedSurfaces('events.read'),
      getSnapshot: () => undefined,
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
      resubscribe,
      cancelSubscription,
      openPaymentPortal
    }
  }

  return {
    client,
    readPlans,
    readPaymentMethods,
    invalidatePaymentMethods,
    reportChallengeStarted,
    reportChallengeSettled,
    previewSubscribe,
    openPaymentPortal,
    subscribe,
    cancelSubscription,
    resubscribe,
    recover,
    readCapabilities,
    invalidateCapabilities,
    readStatus,
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

/** Pending with a hosted continuation: the customer has to be sent to it. */
export function hostedPendingOperation(
  actionUrl: string,
  id = 'op_1'
): PendingBillingOperation {
  return {
    id,
    kind: 'subscription',
    scope: SCOPE,
    observedAt: READ_AT,
    attemptStartedAt: READ_AT,
    presentation: 'hosted',
    hostedDestination: 'stripe',
    phase: 'pending',
    actionUrl,
    customerActionSeen: true
  }
}

/** Pending with an in-page challenge this tab has to drive. */
export function challengedPendingOperation(
  clientSecret: string,
  id = 'op_1'
): PendingBillingOperation {
  return {
    ...operationIdentity(id),
    phase: 'pending',
    challenge: { status: 'required', clientSecret },
    customerActionSeen: true
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
