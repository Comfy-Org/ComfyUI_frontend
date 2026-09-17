/**
 * The copy keys behind the payment projection, with a default English table
 * a host may override — except the safety line, which only the projection's
 * `noChargeConfirmed` may ever unlock.
 */
import type {
  PaymentProjection,
  PaymentReasonKey,
  PaymentStep
} from './paymentProjection.js'

export type PaymentCopyKey =
  | `billing.step.${PaymentStep}.header`
  | `billing.step.${PaymentStep}.body`
  | `billing.reason.${PaymentReasonKey}`
  | 'billing.action.retry'
  | 'billing.action.continue_verification'
  | 'billing.safety.nothing_was_charged'

const SAFETY_KEY = 'billing.safety.nothing_was_charged'

export const DEFAULT_PAYMENT_COPY: Readonly<Record<PaymentCopyKey, string>> = {
  'billing.step.select.header': 'Choose an option',
  'billing.step.select.body': 'Select a plan or credit amount.',
  'billing.step.preview.header': 'Review payment',
  'billing.step.preview.body': 'Confirm your selection.',
  'billing.step.verifying.header': 'Verify your payment',
  'billing.step.verifying.body': 'Complete verification to continue.',
  'billing.step.canceled.header': 'Payment canceled',
  'billing.step.canceled.body': 'The payment was canceled.',
  'billing.step.declined.header': 'Payment declined',
  'billing.step.declined.body': 'Try another payment method.',
  'billing.step.processing_error.header': 'Payment could not be processed',
  'billing.step.processing_error.body': 'Please try again.',
  'billing.step.payment_received_hold.header': 'Payment received',
  'billing.step.payment_received_hold.body':
    'We are finishing your account update.',
  'billing.step.success.header': 'Payment complete',
  'billing.step.success.body': 'Your account is updated.',
  'billing.reason.generic': 'Something went wrong.',
  'billing.reason.checkout_expired':
    'This checkout expired. Start again when you are ready.',
  'billing.reason.card_declined': 'Your bank declined the payment.',
  'billing.reason.insufficient_funds': 'Your bank reported insufficient funds.',
  'billing.reason.expired_card': 'This card has expired.',
  'billing.reason.incorrect_cvc': 'The security code did not match.',
  'billing.reason.authentication_required':
    'Your bank requires authentication.',
  'billing.reason.authentication_failed':
    'Authentication with your bank did not complete.',
  'billing.reason.processing_error':
    'The payment could not be processed right now.',
  'billing.action.retry': 'Try again',
  'billing.action.continue_verification': 'Continue verification',
  [SAFETY_KEY]: 'Nothing was charged.'
}

export function createPaymentCopy(
  overrides: Partial<Record<PaymentCopyKey, string>> = {}
): Readonly<Record<PaymentCopyKey, string>> {
  const { [SAFETY_KEY]: _protected, ...safe } = overrides
  return { ...DEFAULT_PAYMENT_COPY, ...safe }
}

export interface PaymentCopyKeys {
  readonly header: PaymentCopyKey
  readonly body: PaymentCopyKey
  readonly reason?: PaymentCopyKey
  readonly safety?: typeof SAFETY_KEY
}

export function paymentCopyKeys(
  projection: PaymentProjection
): PaymentCopyKeys {
  return {
    header: `billing.step.${projection.step}.header`,
    body: `billing.step.${projection.step}.body`,
    ...(projection.reasonKey === undefined
      ? {}
      : { reason: `billing.reason.${projection.reasonKey}` as const }),
    ...(projection.step === 'canceled' && projection.noChargeConfirmed
      ? { safety: SAFETY_KEY }
      : {})
  }
}
