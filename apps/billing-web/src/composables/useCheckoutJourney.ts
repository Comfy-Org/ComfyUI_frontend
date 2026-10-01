import type {
  CheckoutEntryFlow,
  CheckoutJourneyPhaseEvent,
  CheckoutUiMode,
  PreviewSubscribeResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'

import type { CheckoutPageEvent } from '@/checkout/checkoutPage'
import {
  entryFlowOf,
  entrySourceOf,
  previewFailureOfPageEvent,
  previewFailureOfResult,
  previewReadyPhase
} from '@/checkout/checkoutJourney'
import { useBillingEntry } from '@/entry/billingEntry'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

/**
 * The checkout journey this view reports, in the phases the cloud app
 * reports, so the funnel compares per surface. It continues the cloud journey
 * the entry link carries as `correlation_id`, and mints an id only for a link
 * that carries none. The entry flow is the quote's, so it reads `unknown`
 * until the first quote lands.
 */
export function useCheckoutJourney(
  uiMode: Extract<CheckoutUiMode, 'embedded' | 'full_page'>
) {
  const { entry } = useBillingEntry()
  const arrival = entry.value
  const journeyId = arrival?.correlationId ?? crypto.randomUUID()
  const enteredAt = new Date().toISOString()
  let entryFlow: CheckoutEntryFlow = 'unknown'
  let lastPreviewRevision: string | undefined
  let awaitingOperation = false
  let billingOpId: string | undefined

  function track(phase: CheckoutJourneyPhaseEvent) {
    billingWebTelemetry.trackCheckoutJourneyEvent({
      checkout_journey_id: journeyId,
      checkout_entered_at: enteredAt,
      assignment_status: 'unavailable',
      ui_mode: uiMode,
      entry_flow: entryFlow,
      entry_source: entrySourceOf(arrival?.source),
      ...(billingOpId !== undefined && { billing_op_id: billingOpId }),
      ...phase
    })
  }

  function enter() {
    track({
      phase: 'entered',
      ...(arrival?.source !== undefined && {
        payment_intent_source: arrival.source
      })
    })
  }

  /** Once per accepted revision: a re-render that prices the same quote again says nothing new. */
  function previewReady(quoted: SubscriptionPreview) {
    entryFlow = entryFlowOf(quoted)
    const phase = previewReadyPhase(quoted)
    if (
      phase.preview_revision !== undefined &&
      phase.preview_revision === lastPreviewRevision
    )
      return
    lastPreviewRevision = phase.preview_revision
    track(phase)
  }

  function submitted() {
    awaitingOperation = true
    billingOpId = undefined
    track({ phase: 'submitted' })
  }

  /** Only the operation a press of Pay issued is linked, never one the checkout recovered. */
  function operationIssued(operationId: string) {
    if (!awaitingOperation) return
    awaitingOperation = false
    billingOpId = operationId
    track({ phase: 'operation_linked', billing_op_id: operationId })
  }

  /** A quote answer, from the embedded checkout. */
  function quoted(result: PreviewSubscribeResult) {
    if (result.status === 'ok' && result.value.allowed) {
      previewReady(result.value)
      return
    }
    const failed = previewFailureOfResult(result)
    if (failed) track(failed)
  }

  /** A page event of the full-page checkout, with the quote it left on screen. */
  function observe(
    event: CheckoutPageEvent,
    shown: SubscriptionPreview | undefined
  ) {
    if (event.type === 'quoted' && shown) return previewReady(shown)
    if (event.type === 'paySubmitted') return submitted()
    const failed = previewFailureOfPageEvent(event)
    if (failed) track(failed)
  }

  return { enter, track, submitted, operationIssued, quoted, observe }
}
