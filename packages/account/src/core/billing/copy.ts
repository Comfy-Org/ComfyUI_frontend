import type { BillingState, BillingStep, ReasonKey } from './types.js'

export type BillingCopyKey =
  | `billing.step.${BillingStep}.header`
  | `billing.step.${BillingStep}.body`
  | `billing.reason.${ReasonKey}`
  | 'billing.action.retry'
  | 'billing.action.continue_verification'
  | 'billing.safety.nothing_was_charged'

export const defaultBillingCopy: Readonly<Record<BillingCopyKey, string>> = {
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
  'billing.reason.declined_generic': 'Your bank declined the payment.',
  'billing.reason.declined_insufficient_funds':
    'Your bank reported insufficient funds.',
  'billing.reason.declined_authentication_required':
    'Your bank requires authentication.',
  'billing.action.retry': 'Try again',
  'billing.action.continue_verification': 'Continue verification',
  'billing.safety.nothing_was_charged': 'Nothing was charged.'
}
export function createBillingCopy(
  overrides: Partial<Record<BillingCopyKey, string>> = {}
) {
  const { ['billing.safety.nothing_was_charged']: _ignored, ...safe } =
    overrides
  return { ...defaultBillingCopy, ...safe }
}
export function billingCopyKeys(state: BillingState) {
  return {
    header: `billing.step.${state.step}.header` as BillingCopyKey,
    body: `billing.step.${state.step}.body` as BillingCopyKey,
    safety:
      state.step === 'canceled' && state.noChargeConfirmed
        ? ('billing.safety.nothing_was_charged' as const)
        : undefined
  }
}
