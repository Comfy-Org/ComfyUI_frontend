import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { getTeamPlanSlug } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import type { SubscribeOptions } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { subscribeInputFrom } from '@/platform/workspace/billing/subscribeInput'
import type { SettledSubscribeResponse } from '@/platform/workspace/billing/sdk/subscriptionOperationView'
import { useSubscriptionRail } from '@/platform/workspace/composables/useSubscriptionRail'
import { trackWorkspaceCheckoutStarted } from '@/platform/workspace/utils/workspaceCheckoutTelemetry'

import { paymentReturnUrl } from './paymentReturnUrl'
import type { BillingCycle } from './subscriptionTierRank'

interface PerformTeamSubscriptionCheckoutOptions {
  paymentIntentSource?: PaymentIntentSource
}

/**
 * The subscribe on whichever rail is on. The SDK settles the operation before
 * it returns, so `subscribed` here means the same thing the legacy `pending`
 * statuses mean once their poller finishes. `unavailable` is the backend gate
 * still closed on these routes — the legacy call runs, as everywhere else.
 */
async function issueTeamSubscribe(
  planSlug: string,
  options: SubscribeOptions
): Promise<SettledSubscribeResponse> {
  const rail = useSubscriptionRail()
  if (rail) {
    const outcome = await rail.subscribe(subscribeInputFrom(planSlug, options))
    if (outcome.status === 'error') throw outcome.error
    if (outcome.status === 'ok') return outcome.value
  }
  return workspaceApi.subscribe(planSlug, options)
}

async function initiateTeamSubscriptionCheckout(
  teamCreditStopId: string,
  billingCycle: BillingCycle,
  options: PerformTeamSubscriptionCheckoutOptions
): Promise<void> {
  const planSlug = getTeamPlanSlug(billingCycle)
  const response = await issueTeamSubscribe(planSlug, {
    returnUrl: paymentReturnUrl(),
    cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
    teamCreditStopId
  })

  trackWorkspaceCheckoutStarted({
    tier: 'team',
    cycle: billingCycle,
    checkoutType: 'new',
    billingOpId: response.billing_op_id,
    paymentIntentSource: options.paymentIntentSource
  })

  if (response.status === 'needs_payment_method') {
    // A needs_payment_method response without a URL is unusable: surface it to
    // the caller's error handling rather than silently dropping the user home
    // with a subscription stuck mid-payment.
    if (!response.payment_method_url) {
      throw new Error(
        'Team subscription needs a payment method but no payment URL was returned'
      )
    }
    globalThis.location.href = response.payment_method_url
    return
  }

  globalThis.location.href = '/'
}

/**
 * Direct team-plan checkout for the marketing `/cloud/subscribe?tier=team` deep
 * link: subscribes to the per-credit Team plan at the chosen slider stop and
 * sends the user straight to the Stripe payment page.
 *
 * Mirrors `performSubscriptionCheckout` (personal) but routes through the
 * workspace billing endpoint (`POST /api/billing/subscribe`), because the
 * per-credit Team plan lives there and the backend lets any workspace — personal
 * included — subscribe to it. The slug encodes the cadence; the stop id is
 * validated and priced server-side.
 *
 * Caller guards on `isCloud`, owns loading state, and wraps error handling. A
 * `needs_payment_method` response is a full-page redirect to Stripe; the other
 * statuses land back in the app, which polls the billing op to completion.
 */
export async function performTeamSubscriptionCheckout(
  teamCreditStopId: string,
  billingCycle: BillingCycle,
  options: PerformTeamSubscriptionCheckoutOptions = {}
): Promise<void> {
  if (!isCloud) return

  try {
    await initiateTeamSubscriptionCheckout(
      teamCreditStopId,
      billingCycle,
      options
    )
  } catch (error) {
    useTelemetry()?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      tier: 'team',
      cycle: billingCycle,
      checkout_type: 'new',
      payment_intent_source: options.paymentIntentSource,
      failure_category: categorizeBillingApiError(error)
    })
    throw error
  }
}
