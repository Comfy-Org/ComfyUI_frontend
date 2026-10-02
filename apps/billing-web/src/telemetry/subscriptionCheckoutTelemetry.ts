import type {
  BillingCycle,
  BillingTelemetryEvent,
  PaymentIntentSource,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType,
  SubscriptionCheckoutUi,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import { isAnnualDuration } from '@comfyorg/account-ui/billing/checkout'

import type { AttemptEvents } from '@/telemetry/attemptTelemetry'
import { createAttemptTelemetry } from '@/telemetry/attemptTelemetry'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

/** What a pay press chooses: the plan the quote prices and where the customer came from. */
export interface CheckoutAttempt {
  readonly tier?: SubscriptionCheckoutTier
  readonly cycle: BillingCycle
  readonly checkoutType: SubscriptionCheckoutType
  readonly source?: PaymentIntentSource
}

type ServerTier = SubscriptionPreview['new_plan']['tier']

const TIER_BY_SERVER_TIER: Record<
  ServerTier,
  SubscriptionCheckoutTier | undefined
> = {
  FREE: 'free',
  STANDARD: 'standard',
  CREATOR: 'creator',
  PRO: 'pro',
  FOUNDERS_EDITION: 'founder',
  TEAM: 'team',
  ENTERPRISE: undefined
}

export function checkoutAttemptOf(
  quote: SubscriptionPreview,
  entry: { readonly source?: PaymentIntentSource } | undefined
): CheckoutAttempt {
  return {
    tier: TIER_BY_SERVER_TIER[quote.new_plan.tier],
    cycle: isAnnualDuration(quote.new_plan.duration) ? 'yearly' : 'monthly',
    checkoutType:
      quote.transition_type === 'new_subscription' ? 'new' : 'change',
    source: entry?.source
  }
}

function subscriptionCheckoutEvents(
  ui: SubscriptionCheckoutUi
): AttemptEvents<CheckoutAttempt> {
  const describe = (attempt: CheckoutAttempt) =>
    ({
      operation: 'subscription_checkout',
      billing_client: 'sdk',
      checkout_ui: ui,
      tier: attempt.tier,
      cycle: attempt.cycle,
      checkout_type: attempt.checkoutType,
      payment_intent_source: attempt.source
    }) as const

  return {
    begin: (attempt) => [
      { ...describe(attempt), stage: 'intent', outcome: 'pending' },
      { ...describe(attempt), stage: 'started', outcome: 'pending' }
    ],
    end: (attempt, outcome, durationMs) =>
      outcome.kind === 'succeeded'
        ? {
            ...describe(attempt),
            stage: 'succeeded',
            outcome: 'success',
            billing_op_id: outcome.billingOpId,
            duration_ms: durationMs
          }
        : {
            ...describe(attempt),
            stage: 'failed',
            outcome: 'failure',
            ...outcome.failure,
            billing_op_id: outcome.billingOpId,
            decline_reason: outcome.declineReason,
            duration_ms: durationMs
          }
  }
}

export function createSubscriptionCheckoutTelemetry({
  ui,
  track = billingWebTelemetry.trackBillingEvent,
  now
}: {
  readonly ui: SubscriptionCheckoutUi
  readonly track?: (event: BillingTelemetryEvent) => void
  readonly now?: () => number
}) {
  return createAttemptTelemetry({
    events: subscriptionCheckoutEvents(ui),
    track,
    now
  })
}
