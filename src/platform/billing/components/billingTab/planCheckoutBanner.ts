import type { BillingOpStatusResponse } from '@comfyorg/ingest-types'

export type PlanCheckoutBanner =
  | { kind: 'verifyPayment'; opId: string; actionUrl: string | null }
  | { kind: 'paymentReceived'; opId: string }

/** The Billing-tab plan banner for a served `checkout_state`. */
export function planCheckoutBannerFor(
  operation: BillingOpStatusResponse
): PlanCheckoutBanner | null {
  switch (operation.checkout_state) {
    case 'verify_payment':
      return {
        kind: 'verifyPayment',
        opId: operation.id,
        actionUrl: operation.action_url ?? null
      }
    case 'payment_received':
      return { kind: 'paymentReceived', opId: operation.id }
    default:
      return null
  }
}
