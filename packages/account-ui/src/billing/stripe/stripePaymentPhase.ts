/**
 * What the payment form reports as it mounts, validates and tokenises. The
 * host owns the telemetry sink and whatever journey context it stamps on
 * these; the form only says what happened.
 */
export type StripeElementKind = 'payment' | 'address'
export type StripeElementPhase = 'init' | 'mount' | 'update'
export type StripeSubmitPhase = 'validation' | 'token_creation'

export type StripePaymentPhase =
  | { phase: 'payment_element_ready'; element: StripeElementKind }
  | {
      phase: 'payment_element_failed'
      element: StripeElementKind
      element_phase: StripeElementPhase
      error_code?: string
    }
  | { phase: 'payment_submit_attempted' }
  | {
      phase: 'payment_submit_failed'
      submit_phase: StripeSubmitPhase
      error_code?: string
    }

/**
 * Host-translated strings. The pay action is not here: it renders through the
 * `submit` slot, so its label travels with the host's own button.
 */
export interface StripePaymentCopy {
  readonly paymentMethod: string
  readonly methodChoice: string
  readonly billingAddress: string
  readonly alipayRenewalNote: string
  /** Shown when the key or the method configuration is missing or unusable. */
  readonly unavailable: string
  /** Fallback when the provider reports a failure without a message. */
  readonly genericError: string
}
