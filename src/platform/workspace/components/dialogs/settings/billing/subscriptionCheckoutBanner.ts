import type {
  BillingOpReceiptPlan,
  BillingOpStatusResponse
} from '@comfyorg/ingest-types'

import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import type { ServerFact } from '@/platform/serverFacts/serverFact'
import type { TopupCheckoutBanner } from '@/platform/workspace/components/dialogs/settings/billing/topupCheckoutBanner'

export type SubscriptionCheckoutBanner =
  | {
      kind: 'planFailed'
      opId: string
      plan: BillingOpReceiptPlan | null
      retryable: boolean
    }
  | { kind: 'planProcessing'; opId: string; plan: BillingOpReceiptPlan | null }
  | { kind: 'planUnfinished'; opId: string; plan: BillingOpReceiptPlan }

export type CheckoutBanner = TopupCheckoutBanner | SubscriptionCheckoutBanner

const CHECKOUT_BANNER_RANK: Record<CheckoutBanner['kind'], number> = {
  planFailed: 0,
  failed: 0,
  creditsApplying: 1,
  planProcessing: 2,
  processing: 2,
  planUnfinished: 3
}

type SubscriptionCheckoutState = 'failed' | 'processing' | 'unfinished' | 'none'

function subscriptionCheckoutState(
  operation: BillingOpStatusResponse
): ServerFact<'subscription_checkout_state', SubscriptionCheckoutState> {
  return pendingServerFact(
    'BE-21811',
    operation.status === 'failed' && operation.decline_reason
      ? 'failed'
      : operation.status !== 'pending'
        ? 'none'
        : operation.authentication_state === 'processing'
          ? 'processing'
          : operation.phase === 'awaiting_payment_method' &&
              !operation.action_url
            ? 'unfinished'
            : 'none'
  )
}

/** The DES-1267 plan banner a subscription operation's checkout state calls for. */
export function subscriptionCheckoutBannerFor(
  operation: BillingOpStatusResponse
): SubscriptionCheckoutBanner | null {
  const opId = operation.id
  const plan = operation.plan ?? null
  switch (subscriptionCheckoutState(operation)) {
    case 'failed':
      return {
        kind: 'planFailed',
        opId,
        plan,
        retryable: operation.retryable === true
      }
    case 'processing':
      return { kind: 'planProcessing', opId, plan }
    case 'unfinished':
      return plan ? { kind: 'planUnfinished', opId, plan } : null
  }
  return null
}

/** The one checkout banner to show across plan and top-up, ranked as DES-1234 orders them. */
export function pickCheckoutBanner(
  candidates: readonly (CheckoutBanner | null)[]
): CheckoutBanner | null {
  return candidates.reduce<CheckoutBanner | null>(
    (best, candidate) =>
      candidate &&
      (!best ||
        CHECKOUT_BANNER_RANK[candidate.kind] < CHECKOUT_BANNER_RANK[best.kind])
        ? candidate
        : best,
    null
  )
}
