/**
 * The embedded checkout's styled steps, shared so the cloud app and
 * billing-web render one confirm, one saved-method picker, one card form and
 * one success screen. Unlike `../index` these choose a look: the app's
 * design-system classes. Hosts supply translated copy, the plan they
 * resolved, and the quote; routing, dialogs and telemetry stay with them.
 */
export type {
  CheckoutCopy,
  CheckoutInviteCopy,
  CheckoutReactivationCopy,
  CheckoutSavedMethodCopy,
  CheckoutSuccessCopy,
  CheckoutTermsCopy
} from './checkoutCopy'
export type { CheckoutBillingCycle, CheckoutPlan } from './checkoutQuote'
export {
  amountDueTodayChanged,
  formatAmountDueToday,
  formatQuoteMoney,
  formatRenewalAmount,
  isAnnualDuration,
  isYearlyCheckout,
  resolveRenewalDate
} from './checkoutQuote'
export {
  EMAIL_DELIMITER,
  isValidEmail,
  normalizeEmail,
  sanitizeInviteEmails
} from './inviteEmails'
export { default as CheckoutPaymentForm } from './CheckoutPaymentForm.vue'
export { default as CheckoutSavedMethods } from './CheckoutSavedMethods.vue'
export { default as CheckoutSubscribeConfirm } from './CheckoutSubscribeConfirm.vue'
export { default as CheckoutSuccess } from './CheckoutSuccess.vue'
export { default as CheckoutTeamSuccess } from './CheckoutTeamSuccess.vue'
export { default as CheckoutTermsNote } from './CheckoutTermsNote.vue'
export { default as CheckoutTransitionConfirm } from './CheckoutTransitionConfirm.vue'
