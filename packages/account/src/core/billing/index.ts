/**
 * The billing half of the account layer: framework-free by construction, so
 * the composables and components that present this state live in their own
 * view package rather than here.
 *
 * This entry carries the host ports, the session-backed transport, and the
 * read path over it. The payment commands and their state machine land on
 * top of these same contracts.
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
export type {
  BillingCapabilities,
  CapabilitiesReadOptions,
  CapabilitiesReader,
  CapabilitiesReaderOptions,
  CapabilitiesSnapshot,
  CapabilityRolloutDefaults,
  CapabilityScope
} from './capabilities.js'
export {
  CAPABILITIES_ROUTE,
  CAPABILITY_REVISION_HEADER,
  createCapabilitiesReader,
  readCapabilityRevision
} from './capabilities.js'
export type {
  CapabilityDenialReason,
  CapabilityDenials
} from './capabilityDenials.js'
export { decodeCapabilityDenials } from './capabilityDenials.js'
export type {
  BillingBalance,
  CreditsReadOptions,
  CreditsReader,
  CreditsReaderOptions,
  CreditsScope,
  CreditsSnapshot
} from './credits.js'
export { CREDITS_ROUTE, createCreditsReader } from './credits.js'
