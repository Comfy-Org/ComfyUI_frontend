import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

export interface ProcessingTopupPayment {
  paymentAmountCents: number | null
}

function servedPaymentAmount(cents: number | null): number | null {
  return cents !== null && Number.isSafeInteger(cents) && cents >= 0
    ? cents
    : null
}

export function processingTopupPayment(
  checkouts: readonly HostedTopupCheckout[]
): ProcessingTopupPayment | null {
  const processing = checkouts.filter(
    (checkout) => checkout.state === 'payment_processing'
  )
  if (processing.length === 0) return null

  if (processing.length !== 1) return { paymentAmountCents: null }

  return {
    paymentAmountCents: servedPaymentAmount(processing[0].payment_amount_cents)
  }
}
