import type { HostedBillingIntent, PaymentIntentSource } from './vocabulary.js'

/** Mirrors `BillingProduct` in `@comfyorg/billing-contract`; a type test there fails when the two drift. */
export type WebEntryProduct = 'comfyui' | 'platform' | 'workshop' | 'models'

/** Mirrors `BillingEntryErrorCode` in `@comfyorg/billing-contract`; a type test there fails when the two drift. */
export type WebEntryErrorCode =
  | 'UNSUPPORTED_VERSION'
  | 'UNKNOWN_INTENT'
  | 'UNKNOWN_PRODUCT'
  | 'UNKNOWN_RETURN_TARGET'
  | 'INVALID_AMOUNT'
  | 'INVALID_PLAN'
  | 'INVALID_CORRELATION_ID'
  | 'INVALID_WORKSPACE_ID'
  | 'INVALID_TEAM_CREDIT_STOP_ID'
  | 'INVALID_PROMOTION_CODE'

export type WebEntryBounceReason =
  | 'pricing_link'
  | 'planless_checkout'
  | 'return_target_rewritten'

/** A `ReturnTarget` of `@comfyorg/billing-contract` (a type test there pins them) or the host's pricing table. */
export type WebEntryBounceTarget =
  | 'comfyui_workspace'
  | 'comfyui_credits'
  | 'platform_account'
  | 'platform_billing'
  | 'pricing_table'

export type WebEntryBillingEvent = {
  operation: 'web_entry'
  outcome: 'pending'
} & (
  | {
      stage: 'received'
      intent: HostedBillingIntent
      product: WebEntryProduct
      has_plan: boolean
      payment_intent_source?: PaymentIntentSource
      /** The cloud journey id the entry link carries; links from other products carry none. */
      correlation_id?: string
    }
  | { stage: 'rejected'; error_code: WebEntryErrorCode }
  | {
      stage: 'bounced'
      reason: WebEntryBounceReason
      to: WebEntryBounceTarget
    }
)
