import type {
  CheckoutEntryFlow,
  CheckoutEntrySource,
  CheckoutJourneyPhaseEvent,
  PreviewSubscribeResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { BillingSource } from '@comfyorg/billing-contract'

import type { CheckoutPageEvent } from '@/checkout/checkoutPage'
import type { PromoEntry } from '@/checkout/promoEntry'
import { promoRejectionOf } from '@/checkout/promoEntry'
import { failureOfCode } from '@/telemetry/attemptTelemetry'

type PreviewReadyPhase = Extract<
  CheckoutJourneyPhaseEvent,
  { phase: 'preview_ready' }
>
type PreviewFailedPhase = Extract<
  CheckoutJourneyPhaseEvent,
  { phase: 'preview_failed' }
>

const ENTRY_SOURCE_OF: Partial<Record<BillingSource, CheckoutEntrySource>> = {
  agent_paywall: 'agent_paywall',
  deep_link: 'deep_link',
  settings_billing_panel: 'settings_billing'
}

/** The journey's coarse entry, for the sources it has a name for; the link's own value rides on `entered`. */
export function entrySourceOf(
  source: BillingSource | undefined
): CheckoutEntrySource {
  if (source === undefined) return 'unknown'
  return ENTRY_SOURCE_OF[source] ?? 'other'
}

export function entryFlowOf(
  quoted: Pick<SubscriptionPreview, 'transition_type'>
): CheckoutEntryFlow {
  return quoted.transition_type === 'new_subscription'
    ? 'initial_subscription'
    : 'paid_upgrade'
}

export function previewReadyPhase(
  quoted: SubscriptionPreview
): PreviewReadyPhase {
  const hasIdentity =
    Boolean(quoted.quote_id) && quoted.quote_version !== undefined
  return {
    phase: 'preview_ready',
    ...(hasIdentity && {
      preview_revision: `${quoted.quote_id}:${quoted.quote_version}`
    })
  }
}

const QUOTE_REFUSED: PreviewFailedPhase = {
  phase: 'preview_failed',
  failure_category: 'api_rejected',
  error_code: 'quote_not_allowed'
}

/** What the full-page checkout's own refusals and failed reads say about a preview. */
export function previewFailureOfPageEvent(
  event: CheckoutPageEvent
): PreviewFailedPhase | undefined {
  switch (event.type) {
    case 'refused':
      return {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        denial_reason: event.reason
      }
    case 'capabilitiesFailed':
    case 'unavailable':
      return {
        phase: 'preview_failed',
        failure_category: failureOfCode(event.code, event.httpStatus)
          .failure_category
      }
    case 'notAllowed':
      return QUOTE_REFUSED
    case 'planUnavailable':
      return {
        phase: 'preview_failed',
        failure_category:
          event.reason === 'retired' ? 'api_rejected' : 'validation',
        error_code: 'plan_unavailable'
      }
    default:
      return undefined
  }
}

/** What a quote answer says about a failed preview; a read a newer quote overtook says nothing. */
export function previewFailureOfResult(
  result: PreviewSubscribeResult
): PreviewFailedPhase | undefined {
  if (result.status === 'ok')
    return result.value.allowed ? undefined : QUOTE_REFUSED
  if (result.code === 'SUPERSEDED') return undefined
  return {
    phase: 'preview_failed',
    failure_category: failureOfCode(
      result.code,
      'httpStatus' in result ? result.httpStatus : undefined
    ).failure_category
  }
}

type MethodSelectedPhase = Extract<
  CheckoutJourneyPhaseEvent,
  { phase: 'method_selected' }
>
type PromoPhase = Extract<CheckoutJourneyPhaseEvent, { phase: 'promo' }>

export type PaymentRail = MethodSelectedPhase['rail']
export type PromoResult = PromoPhase['result']

export function methodKindOf(
  methodType: string | undefined
): MethodSelectedPhase['method_kind'] {
  if (methodType === undefined || methodType === '') return undefined
  return methodType === 'card' || methodType === 'alipay' ? methodType : 'other'
}

export function methodSelectedPhase(
  rail: PaymentRail,
  methodType: string | undefined
): MethodSelectedPhase {
  const kind = methodKindOf(methodType)
  return {
    phase: 'method_selected',
    rail,
    ...(kind !== undefined && { method_kind: kind })
  }
}

/** The code a promo entry just settled on, from the move it made; typing and in-flight moves settle nothing. */
export function promoSettlementOf(
  before: PromoEntry,
  after: PromoEntry
): { readonly result: PromoResult; readonly code: string } | undefined {
  if (before.kind === 'applying' && after.kind === 'applied')
    return { result: 'applied', code: before.draft }
  if (
    before.kind === 'applying' &&
    after.kind === 'rejected' &&
    after.reason === 'invalid'
  )
    return { result: 'rejected', code: before.draft }
  if (before.kind === 'removing' && after.kind === 'idle')
    return { result: 'removed', code: before.code }
  if (before.kind === 'applied' && after.kind === 'idle')
    return { result: 'expired', code: before.code }
  return undefined
}

/** What a quote priced with a code says about it; a quote that failed for another reason judged nothing. */
export function promoResultOfQuote(
  result: PreviewSubscribeResult
): 'applied' | 'rejected' | undefined {
  if (result.status === 'ok')
    return result.value.promotion_code ? 'applied' : 'rejected'
  return promoRejectionOf(result) === 'invalid' ? 'rejected' : undefined
}
