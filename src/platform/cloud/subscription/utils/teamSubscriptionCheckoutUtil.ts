import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { getTeamPlanSlug } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { isCloud } from '@/platform/distribution/types'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { trackWorkspaceCheckoutStarted } from '@/platform/workspace/utils/workspaceCheckoutTelemetry'

import type { BillingCycle } from './subscriptionTierRank'

interface PerformTeamSubscriptionCheckoutOptions {
  paymentIntentSource?: PaymentIntentSource
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

  const planSlug = getTeamPlanSlug(billingCycle)
  const response = await workspaceApi.subscribe(planSlug, {
    returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
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
