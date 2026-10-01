import type {
  BillingTelemetryFailureCategory,
  CheckoutEntryFlow,
  CheckoutEntrySource,
  CheckoutJourneyPhaseEvent,
  PreviewSubscribeResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { BillingSource } from '@comfyorg/billing-contract'

import type { CheckoutPageEvent } from '@/checkout/checkoutPage'

type PreviewReadyPhase = Extract<
  CheckoutJourneyPhaseEvent,
  { phase: 'preview_ready' }
>
type PreviewFailedPhase = Extract<
  CheckoutJourneyPhaseEvent,
  { phase: 'preview_failed' }
>

export function entrySourceOf(
  _source: BillingSource | undefined
): CheckoutEntrySource {
  throw new Error('not implemented')
}

export function entryFlowOf(
  _quoted: Pick<SubscriptionPreview, 'transition_type'>
): CheckoutEntryFlow {
  throw new Error('not implemented')
}

export function failureCategoryOf(_failure: {
  readonly code: string
  readonly httpStatus?: number
}): BillingTelemetryFailureCategory {
  throw new Error('not implemented')
}

export function previewReadyPhase(
  _quoted: SubscriptionPreview
): PreviewReadyPhase {
  throw new Error('not implemented')
}

export function previewFailureOfPageEvent(
  _event: CheckoutPageEvent
): PreviewFailedPhase | undefined {
  throw new Error('not implemented')
}

export function previewPhaseOfResult(
  _result: PreviewSubscribeResult
): PreviewReadyPhase | PreviewFailedPhase | undefined {
  throw new Error('not implemented')
}
