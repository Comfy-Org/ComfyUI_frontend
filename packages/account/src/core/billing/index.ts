/**
 * The billing half of the account layer: framework-free by construction, so
 * the composables and components that present this state live in their own
 * view package rather than here.
 *
 * This entry currently carries the host ports and the session-backed
 * transport. The typed credits and capabilities reads, and the payment
 * commands with their state machine, land on top of these contracts.
 */
export type {
  BillingErrorCode,
  BillingFailure,
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
export type { SessionBillingTransportOptions } from './transport.js'
export { createSessionBillingTransport } from './transport.js'
