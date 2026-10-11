import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { consumePaymentReturn } from '@/platform/cloud/subscription/utils/paymentReturnUrl'

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
  const billingContext = useBillingContext()
  const { flags } = useFeatureFlags()

  async function loadPaymentReturnFromUrl() {
    if (!consumePaymentReturn()) return
    if (!flags.embeddedCheckoutEnabled) return
    await billingContext.fetchStatus()
  }

  return {
    loadPaymentReturnFromUrl
  }
}
