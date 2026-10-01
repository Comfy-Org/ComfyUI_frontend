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

export function failureCategoryOf({
  code,
  httpStatus
}: {
  readonly code: string
  readonly httpStatus?: number
}): BillingTelemetryFailureCategory {
  switch (code) {
    case 'REQUEST_FAILED':
      return httpStatus === undefined ? 'network' : 'api_rejected'
    case 'NOT_AUTHENTICATED':
    case 'ACCESS_DENIED':
    case 'NOT_FOUND':
    case 'CONFLICT':
    case 'OPERATION_ALREADY_PENDING':
    case 'NO_ACTIVE_SUBSCRIPTION':
      return 'api_rejected'
    case 'INVALID_REQUEST':
      return 'validation'
    default:
      return 'unknown'
  }
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
        failure_category: failureCategoryOf(event)
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
    failure_category: failureCategoryOf(result)
  }
}
