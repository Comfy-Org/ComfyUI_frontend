import type { CreateTopupResponse } from '@comfyorg/ingest-types'

import type {
  BillingCheckoutReceived,
  BillingFailed,
  BillingIntent,
  BillingRequestSent,
  BillingStarted,
  BillingSucceeded
} from './stages.js'
import type { PaymentIntentSource } from './vocabulary.js'

/** The fixed amounts, in USD, a top-up dialog offers as one-click choices. */
export const TOPUP_AMOUNT_PRESETS_USD = [10, 25, 50, 100] as const

/** The preset the customer picked, or `custom` for any typed amount. */
export type TopupAmountPreset =
  | `${(typeof TOPUP_AMOUNT_PRESETS_USD)[number]}`
  | 'custom'

export function getTopupAmountPreset(
  pickedPresetUsd: number | null
): TopupAmountPreset {
  const preset = TOPUP_AMOUNT_PRESETS_USD.find((usd) => usd === pickedPresetUsd)
  return preset === undefined ? 'custom' : `${preset}`
}

type TopupStarted = BillingStarted & {
  /** The amount being bought, in whole cents. */
  amount_cents?: number
  amount_preset?: TopupAmountPreset
}

export type TopupBillingEvent = {
  operation: 'topup'
  billing_op_id?: string
  /**
   * Surface the top-up was opened from. Absent when the caller named none,
   * exactly as on the subscription rail's events — absent is no claim, never
   * an implied default. Named `payment_intent_source` to match its siblings
   * above; the journey's own `entry_source` is a separate, smaller enum.
   */
  payment_intent_source?: PaymentIntentSource
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event.
   */
  duration_ms?: number
} & (
  | BillingIntent
  | BillingCheckoutReceived<CreateTopupResponse['status']>
  | BillingRequestSent
  | TopupStarted
  | BillingSucceeded
  | BillingFailed
)
