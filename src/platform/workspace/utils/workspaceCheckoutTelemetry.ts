import { storeToRefs } from 'pinia'

import { useTelemetry } from '@/platform/telemetry'
import type {
  PaymentIntentSource,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType
} from '@/platform/telemetry/types'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useAuthStore } from '@/stores/authStore'

interface TrackWorkspaceCheckoutStartedOptions {
  tier: SubscriptionCheckoutTier
  cycle: BillingCycle
  checkoutType: SubscriptionCheckoutType
  billingOpId: string
  paymentIntentSource?: PaymentIntentSource
}

export function trackWorkspaceCheckoutStarted({
  tier,
  cycle,
  checkoutType,
  billingOpId,
  paymentIntentSource
}: TrackWorkspaceCheckoutStartedOptions) {
  const { userId } = storeToRefs(useAuthStore())
  if (!userId.value) return

  useTelemetry()?.trackBeginCheckout({
    user_id: userId.value,
    tier,
    cycle,
    checkout_type: checkoutType,
    billing_op_id: billingOpId,
    ...(paymentIntentSource
      ? { payment_intent_source: paymentIntentSource }
      : {})
  })
}
