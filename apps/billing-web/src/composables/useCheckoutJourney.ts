import type {
  CheckoutEntryFlow,
  CheckoutJourneyPhaseEvent,
  PreviewSubscribeResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'

import type { CheckoutPageEvent } from '@/checkout/checkoutPage'
import type { PaymentRail, PromoResult } from '@/checkout/checkoutJourney'
import {
  entryFlowOf,
  entrySourceOf,
  methodSelectedPhase,
  previewFailureOfPageEvent,
  previewFailureOfResult,
  previewReadyPhase,
  promoResultOfQuote,
  promoSettlementOf
} from '@/checkout/checkoutJourney'
import type { PromoEntry } from '@/checkout/promoEntry'
import { useBillingEntry } from '@/entry/billingEntry'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

/**
 * The checkout journey this view reports, in the phases the cloud app
 * reports, so the funnel compares per surface. It continues the cloud journey
 * the entry link carries as `correlation_id`, and mints an id only for a link
 * that carries none. The entry flow is the quote's, so it reads `unknown`
 * until the first quote lands.
 */
export function useCheckoutJourney(uiMode: 'embedded' | 'full_page') {
  const { entry } = useBillingEntry()
  const arrival = entry.value
  const journeyId = arrival?.correlationId ?? crypto.randomUUID()
  const enteredAt = new Date().toISOString()
  let entryFlow: CheckoutEntryFlow = 'unknown'
  let lastPreviewRevision: string | undefined
  let presses = 0
  let linkingPress: number | undefined
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

  /** A Pay goes ahead. Returns the press, which only its own settling may close. */
  function submitted(): number {
    const press = ++presses
    linkingPress = press
    billingOpId = undefined
    track({ phase: 'submitted' })
    return press
  }

  /** The command of this press settled, so an operation that surfaces later is not one it issued. */
  function submitSettled(press: number) {
    if (linkingPress === press) linkingPress = undefined
  }

  /** Only the operation a press of Pay issued is linked, never one the checkout recovered. */
  function operationIssued(operationId: string) {
    if (linkingPress === undefined) return
    linkingPress = undefined
    billingOpId = operationId
    track({ phase: 'operation_linked', billing_op_id: operationId })
  }

  function methodSelected(rail: PaymentRail, methodType: string | undefined) {
    track(methodSelectedPhase(rail, methodType))
  }

  /** Reports that a code settled, and whether the link carried it; the code itself goes no further. */
  function promoSettled(result: PromoResult, code: string) {
    track({
      phase: 'promo',
      result,
      prefilled: code.toLowerCase() === arrival?.promotionCode?.toLowerCase()
    })
  }

  /** The full-page checkout's promo entry moved. */
  function promoEntryChanged(before: PromoEntry, after: PromoEntry) {
    const settled = promoSettlementOf(before, after)
    if (settled) promoSettled(settled.result, settled.code)
  }

  /** The embedded checkout's quote priced with a code. */
  function promoQuoted(result: PreviewSubscribeResult, code: string) {
    const settled = promoResultOfQuote(result)
    if (settled) promoSettled(settled, code)
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
    if (event.type === 'consentMissing')
      return track({ phase: 'pay_blocked', reason: 'reactivation_unconfirmed' })
    const failed = previewFailureOfPageEvent(event)
    if (failed) track(failed)
  }

  return {
    enter,
    track,
    submitted,
    submitSettled,
    operationIssued,
    methodSelected,
    promoEntryChanged,
    promoQuoted,
    quoted,
    observe
  }
}
