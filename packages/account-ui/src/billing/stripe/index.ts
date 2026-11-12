/**
 * The provider-bound payment surface, behind its own entry point so a host
 * that wants only the composables in `../index` never installs
 * `@stripe/stripe-js`.
 */
export type {
  StripeElementKind,
  StripeElementPhase,
  StripePaymentCopy,
  StripePaymentPhase,
  StripeSubmitPhase
} from './stripePaymentPhase'
export { default as StripePaymentForm } from './StripePaymentForm.vue'
