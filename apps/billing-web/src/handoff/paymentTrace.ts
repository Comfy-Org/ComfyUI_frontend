import type { BillingOperationState } from '@comfyorg/account-core/billing'
import {
  INTERACTIVE_TOPUP_ROUTE,
  RESUBSCRIBE_ROUTE,
  SUBSCRIBE_ROUTE,
  TOPUP_CHECKOUT_ROUTE,
  TOPUP_ROUTE
} from '@comfyorg/account-core/billing'
import {
  zCreateTopupResponse,
  zResubscribeResponse,
  zSubscribeResponse
} from '@comfyorg/ingest-types/zod'

/** What a handoff session's payments left behind that the operation pointer cannot remember. */
export interface PaymentTrace {
  /** The latest payment operation this session saw succeed. */
  readonly paid?: string
  /** A payment the tab cannot account for: `sent` awaits its answer, `lost` never will get one. */
  readonly unanswered?: 'sent' | 'lost'
  /** The operation a keep-subscription request started, which charges nothing. */
  readonly kept?: string
}

export type PaymentEvent =
  | { readonly type: 'start_sent' }
  | { readonly type: 'start_answered' }
  | { readonly type: 'start_unanswered' }
  | { readonly type: 'payment_succeeded'; readonly operationId: string }
  | { readonly type: 'payment_parked'; readonly operationId: string }
  | { readonly type: 'subscription_kept'; readonly operationId: string }

function afterSuccess(trace: PaymentTrace, operationId: string): PaymentTrace {
  if (operationId === trace.kept || operationId === trace.paid) return trace
  return {
    ...trace,
    paid: operationId,
    unanswered: trace.unanswered === 'lost' ? undefined : trace.unanswered
  }
}

/** Returns the same trace when the event teaches the tab nothing new. */
export function tracePayment(
  trace: PaymentTrace,
  event: PaymentEvent
): PaymentTrace {
  switch (event.type) {
    case 'start_sent':
      return trace.unanswered ? trace : { ...trace, unanswered: 'sent' }
    case 'start_answered':
      return trace.unanswered === 'sent'
        ? { ...trace, unanswered: undefined }
        : trace
    case 'start_unanswered':
      return trace.unanswered === 'lost'
        ? trace
        : { ...trace, unanswered: 'lost' }
    case 'payment_succeeded':
      return afterSuccess(trace, event.operationId)
    case 'payment_parked':
      return event.operationId === trace.kept || trace.unanswered === 'lost'
        ? trace
        : { ...trace, unanswered: 'lost' }
    case 'subscription_kept':
      return { ...trace, kept: event.operationId }
  }
}

/** What an operation the lifecycle reports teaches the tab about a payment. */
export function paymentEventOf(
  operation: BillingOperationState
): PaymentEvent | undefined {
  if (operation.kind === 'cancel') return undefined
  if (operation.phase === 'succeeded')
    return { type: 'payment_succeeded', operationId: operation.id }
  if (operation.phase === 'reconciliation_needed')
    return { type: 'payment_parked', operationId: operation.id }
  return undefined
}

/** How a handoff tab reads one write route's exchange with Cloud. */
export interface TracedWrite {
  readonly sent?: PaymentEvent
  readonly unanswered?: PaymentEvent
  readonly answered: (
    response: Pick<Response, 'ok' | 'status'>,
    body: unknown
  ) => PaymentEvent | undefined
}

function paymentStart(follows: (accepted: unknown) => boolean): TracedWrite {
  return {
    sent: { type: 'start_sent' },
    unanswered: { type: 'start_unanswered' },
    answered: ({ ok, status }, body) => {
      const refused = status >= 400 && status < 500
      const outcomeKnown = ok ? follows(body) : refused
      return { type: outcomeKnown ? 'start_answered' : 'start_unanswered' }
    }
  }
}

const KEEP_SUBSCRIPTION: TracedWrite = {
  answered: ({ ok }, body) => {
    const kept = ok ? zResubscribeResponse.safeParse(body) : undefined
    return kept?.success
      ? { type: 'subscription_kept', operationId: kept.data.billing_op_id }
      : undefined
  }
}

const PAYMENT_ON_A_HOSTED_PAGE = paymentStart(() => false)

/** The write routes whose exchange with Cloud a handoff tab traces, by route. */
export const TRACED_WRITES: ReadonlyMap<string, TracedWrite> = new Map([
  [
    SUBSCRIBE_ROUTE,
    paymentStart((body) => zSubscribeResponse.safeParse(body).success)
  ],
  [
    TOPUP_ROUTE,
    paymentStart((body) => zCreateTopupResponse.safeParse(body).success)
  ],
  [
    INTERACTIVE_TOPUP_ROUTE,
    paymentStart((body) => zCreateTopupResponse.safeParse(body).success)
  ],
  [TOPUP_CHECKOUT_ROUTE, PAYMENT_ON_A_HOSTED_PAGE],
  [RESUBSCRIBE_ROUTE, KEEP_SUBSCRIPTION]
])
