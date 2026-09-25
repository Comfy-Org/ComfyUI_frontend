/**
 * The eight public payment states as a pure projection of one lifecycle
 * operation. A host renders the projection and reports where it is when no
 * operation exists; it never advances the machine itself.
 *
 * A server verdict outranks anything the host reports: a customer who backed
 * out of a page after the charge went through still sees the success.
 */
import type {
  BillingDeclineReason,
  BillingOperationState,
  BillingRecoveryAction,
  PendingBillingOperation
} from './operationState.js'

export type PaymentStep =
  | 'select'
  | 'preview'
  | 'verifying'
  | 'canceled'
  | 'declined'
  | 'processing_error'
  /** Reserved: the contract cannot yet tell "paid, entitlement pending" from "needs a human". */
  | 'payment_received_hold'
  | 'success'

/** Where the host is when nothing is being observed, or the customer backed out. */
export type HostPaymentStep = 'select' | 'preview' | 'canceled'

/**
 * The generated `decline_reason` values plus the two the SDK adds. Every key
 * is a coded reason; raw server or provider text never becomes one.
 * `checkout_expired` is reserved: the generated operation status has no
 * expired state to produce it from.
 */
export type PaymentReasonKey =
  | BillingDeclineReason
  | 'checkout_expired'
  | 'generic'

export interface PaymentProjection {
  readonly step: PaymentStep
  readonly reasonKey?: PaymentReasonKey
  /**
   * What the server tells the customer to do next. A failed operation the
   * server marks non-retryable without naming a recovery reads as
   * `contact_support`, so no dead end ever offers a retry.
   */
  readonly recoveryAction?: BillingRecoveryAction
  /** Present whenever an operation backs the projection; the id support can act on. */
  readonly operationId?: string
  /**
   * Permits "nothing was charged" only once a terminal backend result rules
   * out any later charge; the contract has no such field yet, so always false.
   */
  readonly noChargeConfirmed: boolean
}

/** Reasons that describe a processing fault rather than the customer's card. */
const PROCESSING_REASONS: ReadonlySet<PaymentReasonKey> = new Set([
  'processing_error',
  'generic'
])

const RECOVERY_ACTIONS: Readonly<Record<BillingRecoveryAction, true>> = {
  retry: true,
  replace_payment_method: true,
  authenticate_payment: true,
  contact_support: true
}

/** A recovery action this build cannot act on reads as none named. */
function knownRecoveryAction(
  action: string | undefined
): BillingRecoveryAction | undefined {
  return action !== undefined && isRecoveryAction(action) ? action : undefined
}

function isRecoveryAction(action: string): action is BillingRecoveryAction {
  return Object.hasOwn(RECOVERY_ACTIONS, action)
}

function stepForReason(reason: PaymentReasonKey): PaymentStep {
  return PROCESSING_REASONS.has(reason) ? 'processing_error' : 'declined'
}

function projectPending(
  state: PendingBillingOperation,
  hostStep: HostPaymentStep
): PaymentProjection {
  const base = { operationId: state.id, noChargeConfirmed: false } as const
  if (hostStep === 'canceled') return { ...base, step: 'canceled' }
  const reason =
    state.declineReason ??
    (state.challenge?.status === 'failed' ? 'authentication_failed' : undefined)
  if (reason !== undefined) {
    const recoveryAction = knownRecoveryAction(state.recoveryAction)
    return {
      ...base,
      step: stepForReason(reason),
      reasonKey: reason,
      ...(recoveryAction === undefined ? {} : { recoveryAction })
    }
  }
  const parked = state.challenge !== undefined || state.actionUrl !== undefined
  return { ...base, step: parked ? 'verifying' : 'preview' }
}

export function projectPaymentStep(
  operation: BillingOperationState | undefined,
  hostStep: HostPaymentStep
): PaymentProjection {
  if (operation === undefined) {
    return { step: hostStep, noChargeConfirmed: false }
  }
  const base = { operationId: operation.id, noChargeConfirmed: false } as const
  switch (operation.phase) {
    case 'pending':
      return projectPending(operation, hostStep)
    case 'succeeded':
      return { ...base, step: 'success' }
    case 'failed': {
      const recoveryAction =
        knownRecoveryAction(operation.recoveryAction) ??
        (operation.retryable ? undefined : 'contact_support')
      return {
        ...base,
        step: stepForReason(operation.declineReason),
        reasonKey: operation.declineReason,
        ...(recoveryAction === undefined ? {} : { recoveryAction })
      }
    }
    case 'reconciliation_needed':
      return { ...base, step: 'processing_error', reasonKey: 'generic' }
    case 'timed_out':
      return hostStep === 'canceled'
        ? { ...base, step: 'canceled' }
        : { ...base, step: 'processing_error', reasonKey: 'generic' }
    case 'superseded':
      return { ...base, step: hostStep === 'canceled' ? 'canceled' : 'select' }
  }
}
