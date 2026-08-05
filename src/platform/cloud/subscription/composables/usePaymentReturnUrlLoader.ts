import { useRoute, useRouter } from 'vue-router'

import { useBillingContext } from '@/composables/billing/useBillingContext'

const STRIPE_RETURN_PARAMS = [
  'payment_intent',
  'payment_intent_client_secret',
  'redirect_status'
] as const

/**
 * Handles the return leg of a redirect payment method (Alipay). The checkout's
 * `return_url` points back at the page it started on, and Stripe appends
 * `payment_intent`, `payment_intent_client_secret`, and `redirect_status` to
 * it. The client secret is a bearer capability, so it must not linger in the
 * address bar or history; strip all three, then refresh billing status so the
 * pending-operation recovery resumes polling the in-flight checkout without
 * waiting for the next scheduled read.
 */
export function usePaymentReturnUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const billingContext = useBillingContext()

  async function loadPaymentReturnFromUrl() {
    const present = STRIPE_RETURN_PARAMS.filter(
      (param) => route.query[param] !== undefined
    )
    if (present.length === 0) return

    const cleanQuery = { ...route.query }
    for (const param of present) delete cleanQuery[param]
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn(
        '[usePaymentReturnUrlLoader] Failed to clean URL params:',
        error
      )
    })

    await billingContext.fetchStatus()
  }

  return {
    loadPaymentReturnFromUrl
  }
}
