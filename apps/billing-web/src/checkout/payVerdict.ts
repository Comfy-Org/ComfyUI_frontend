import type { SubscriptionCommandResult } from '@comfyorg/account-core/billing'
import {
  matchesServerCode,
  projectPaymentStep
} from '@comfyorg/account-core/billing'

import type { InlineOutcome } from '@/checkout/checkoutPage'

/** The server refused the quote the customer consented to; re-price before asking again. */
const STALE_QUOTE_SERVER_CODES = [
  'PRORATION_QUOTE_EXPIRED',
  'SUBSCRIPTION_QUOTE_STALE'
] as const

/**
 * What a Pay's result asks of the page. `settled` needs nothing from
 * capture; `requote` prices the plan again first; `failure` is a coded
 * refusal the page states in a line of its own.
 */
export type PayVerdict =
  | { readonly kind: 'settled' }
  | { readonly kind: 'outcome'; readonly outcome: InlineOutcome }
  | {
      readonly kind: 'requote'
      readonly because: 'quote_expired' | 'reactivation_required'
    }
  | { readonly kind: 'failure'; readonly code: string }

export function payVerdictOf(result: SubscriptionCommandResult): PayVerdict {
  if (result.status === 'error') {
    if (
      'serverCode' in result &&
      STALE_QUOTE_SERVER_CODES.some((code) => matchesServerCode(result, code))
    )
      return { kind: 'requote', because: 'quote_expired' }
    switch (result.code) {
      case 'REACTIVATION_CONFIRMATION_REQUIRED':
        return { kind: 'requote', because: 'reactivation_required' }
      case 'OPERATION_ALREADY_PENDING':
      case 'CONFLICT':
        return { kind: 'outcome', outcome: { kind: 'reconciling' } }
      default:
        return { kind: 'failure', code: result.code }
    }
  }
  const { operation } = result.value
  if (operation === undefined) return { kind: 'settled' }
  if (operation.phase === 'timed_out')
    return { kind: 'outcome', outcome: { kind: 'reconciling' } }
  const projection = projectPaymentStep(operation, 'preview')
  const operationId = operation.id
  if (projection.step === 'processing_error')
    return {
      kind: 'outcome',
      outcome: { kind: 'processing_error', operationId }
    }
  if (projection.step !== 'declined') return { kind: 'settled' }
  if (projection.reasonKey === 'authentication_failed')
    return {
      kind: 'outcome',
      outcome: { kind: 'not_completed', operationId }
    }
  return {
    kind: 'outcome',
    outcome: {
      kind: 'declined',
      operationId,
      ...(projection.reasonKey === undefined
        ? {}
        : { reason: projection.reasonKey })
    }
  }
}

const SUPPORT_ADDRESS = 'support@comfy.org'

/** A mail to support that already names the operation and the decline code. */
export function supportLinkFor(outcome: InlineOutcome): string {
  const facts = [
    'operationId' in outcome && outcome.operationId !== undefined
      ? `Operation: ${outcome.operationId}`
      : undefined,
    'reason' in outcome && outcome.reason !== undefined
      ? `Decline code: ${outcome.reason}`
      : undefined
  ].filter((fact) => fact !== undefined)
  const query = new URLSearchParams({
    subject: 'Checkout payment',
    ...(facts.length === 0 ? {} : { body: facts.join('\n') })
  })
  return `mailto:${SUPPORT_ADDRESS}?${query.toString().replaceAll('+', '%20')}`
}
