import type {
  BillingOperationState,
  BillingResult,
  PaymentProjection,
  PaymentReasonKey,
  SubscriptionCommandResult,
  TopupResult
} from '@comfyorg/account-core/billing'
import {
  matchesServerCode,
  projectPaymentStep
} from '@comfyorg/account-core/billing'

import type {
  CheckoutPageEvent,
  InlineOutcome,
  OperationOutcome
} from '@/checkout/checkoutPage'

/** The server refused the quote the customer consented to; re-price before asking again. */
const STALE_QUOTE_SERVER_CODES = ['PRORATION_QUOTE_EXPIRED'] as const

/**
 * What a Pay's result asks of the page. `settled` needs nothing from
 * capture; `requote` prices the plan again first; `outcome` is the card
 * above Pay, a coded refusal included.
 */
export type PayVerdict =
  | { readonly kind: 'settled' }
  | { readonly kind: 'outcome'; readonly outcome: InlineOutcome }
  | {
      readonly kind: 'requote'
      readonly because: 'quote_expired' | 'reactivation_required'
    }

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
      default:
        return refusalVerdict(result)
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
 * A Pay the server refused before any operation settled: one already under
 * way is re-read, never a decline (rule 18); any other is the coded card.
 */
function refusalVerdict(result: {
  readonly code: string
  readonly serverMessage?: string
}): PayVerdict {
  if (result.code === 'OPERATION_ALREADY_PENDING' || result.code === 'CONFLICT')
    return { kind: 'outcome', outcome: { kind: 'reconciling' } }
  return {
    kind: 'outcome',
    outcome: {
      kind: 'processing_error',
      code: result.code,
      ...(result.serverMessage === undefined
        ? {}
        : { serverMessage: result.serverMessage })
    }
  }
}

/**
 * A top-up's Pay: a success needs nothing from capture, a decline is the
 * operation's own card, and an operation the lifecycle stopped watching is
 * re-read rather than guessed at.
 */
export function topupVerdictOf(result: TopupResult): PayVerdict {
  switch (result.status) {
    case 'ok':
      return { kind: 'settled' }
    case 'declined':
      return {
        kind: 'outcome',
        outcome: operationOutcomeOf(result.operation) ?? {
          kind: 'processing_error',
          operationId: result.operation.id
        }
      }
    case 'unsettled':
      return { kind: 'outcome', outcome: { kind: 'reconciling' } }
    case 'error':
      return refusalVerdict(result)
  }
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

export function outcomeFor(operation: BillingOperationState) {
  const outcome = operationOutcomeOf(operation)
  return outcome === undefined ? {} : { outcome }
}

/**
 * A recovery the lifecycle refused is an unknown, not "nothing pending": in
 * resolving it ends on a screen that claims nothing about money, and
 * anywhere else the page keeps what it has rather than opening a form over
 * money it cannot see.
 */
export function reconciledEvent(
  recovered: BillingResult<BillingOperationState | undefined>
): CheckoutPageEvent {
  if (recovered.status === 'error')
    return { type: 'recheckFailed', code: recovered.code }
  const operation = recovered.value
  return {
    type: 'reconciled',
    operation,
    ...(operation === undefined ? {} : outcomeFor(operation))
  }
}

/** Declines that mean the customer never finished paying, not a refused card. */
const NOT_COMPLETED_REASONS: ReadonlySet<PaymentReasonKey> = new Set([
  'authentication_failed',
  'authentication_required',
  'payment_not_completed'
])

/**
 * Payment not completed, on the server's word: a 3DS challenge or an
 * Alipay authorization left unfinished, or an attempt it ended unpaid with
 * no reason beyond a plain retry (an abandoned challenge or checkout).
 */
function isNotCompleted(projection: PaymentProjection): boolean {
  const { reasonKey } = projection
  if (reasonKey !== undefined && NOT_COMPLETED_REASONS.has(reasonKey))
    return true
  return reasonKey === 'generic' && projection.recoveryAction === 'retry'
}

const SUPPORT_ADDRESS = 'support@comfy.org'

/** A mail to support that already names the operation, the decline code, or the refusal's code. */
export function supportLinkFor(outcome: InlineOutcome): string {
  const facts = [
    'operationId' in outcome && outcome.operationId !== undefined
      ? `Operation: ${outcome.operationId}`
      : undefined,
    'code' in outcome && outcome.kind === 'processing_error'
      ? `Error code: ${outcome.code}`
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
