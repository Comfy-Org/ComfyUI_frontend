import { computed } from 'vue'

import { getBillingPolicyCapabilities } from '../billingPolicyCapabilities'
import type { BillingPolicyCapabilities } from '../billingPolicyCapabilities'
import { useBillingPolicyState } from './useBillingPolicyState'

/**
 * Billing policy capabilities derived from distribution and subscription
 * signals. Authorization and feature flags remain separate checks.
 */
export function useBillingPolicyCapabilities() {
  const { billingPolicyState } = useBillingPolicyState()

  const billingPolicyCapabilities = computed<BillingPolicyCapabilities>(() =>
    getBillingPolicyCapabilities(billingPolicyState.value)
  )

  return { billingPolicyCapabilities }
}
