import type {
  BillingOperationState,
  PaymentProjection,
  PaymentReasonKey,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'
import {
  matchesServerCode,
  projectPaymentStep
} from '@comfyorg/account-core/billing'

import type { InlineOutcome, OperationOutcome } from '@/checkout/checkoutPage'

/** The server refused the quote the customer consented to; re-price before asking again. */
const STALE_QUOTE_SERVER_CODES = ['PRORATION_QUOTE_EXPIRED'] as const

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
      case 'QUOTE_STALE':
        return { kind: 'requote', because: 'quote_expired' }
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
  if (
    operation.phase === 'timed_out' ||
    operation.phase === 'reconciliation_needed'
  )
    return { kind: 'outcome', outcome: { kind: 'reconciling' } }
  const outcome = operationOutcomeOf(operation)
  return outcome === undefined
    ? { kind: 'settled' }
    : { kind: 'outcome', outcome }
}

/**
 * The card an operation's own verdict earns, through the shared projection.
 * Nothing for one still pending or succeeded, and nothing for a poll budget
 * that ran out or an operation parked for a human: an unknown outcome never
 * gets the card (rule 12).
 */
export function operationOutcomeOf(
  operation: BillingOperationState
): OperationOutcome | undefined {
  if (
    operation.phase === 'timed_out' ||
    operation.phase === 'superseded' ||
    operation.phase === 'reconciliation_needed'
  )
    return undefined
  const projection = projectPaymentStep(operation, 'preview')
  const operationId = operation.id
  if (isNotCompleted(projection)) return { kind: 'not_completed', operationId }
  if (projection.step === 'processing_error')
    return { kind: 'processing_error', operationId }
  if (projection.step !== 'declined') return undefined
  return {
    kind: 'declined',
    operationId,
    ...(projection.reasonKey === undefined
      ? {}
      : { reason: projection.reasonKey })
  }
}

/** Declines that mean the customer never finished authenticating, not a refused card. */
const UNAUTHENTICATED_REASONS: ReadonlySet<PaymentReasonKey> = new Set([
  'authentication_failed',
  'authentication_required'
])

/**
 * Payment not completed, on the server's word: a 3DS challenge or an
 * Alipay authorization left unfinished, or an attempt it ended unpaid with
 * no reason beyond a plain retry (an abandoned challenge or checkout).
 */
function isNotCompleted(projection: PaymentProjection): boolean {
  const { reasonKey } = projection
  if (reasonKey !== undefined && UNAUTHENTICATED_REASONS.has(reasonKey))
    return true
  return reasonKey === 'generic' && projection.recoveryAction === 'retry'
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
  return supportMail(facts)
}

/** A mail to support that quotes the code an ending screen shows. */
export function supportLinkWithCode(code: string | undefined): string {
  return supportMail(code === undefined ? [] : [`Reference: ${code}`])
}

function supportMail(facts: readonly string[]): string {
  const query = new URLSearchParams({
    subject: 'Checkout payment',
    ...(facts.length === 0 ? {} : { body: facts.join('\n') })
  })
  return `mailto:${SUPPORT_ADDRESS}?${query.toString().replaceAll('+', '%20')}`
}
