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
  BillingServerCode,
  BillingSession,
  BillingTransport
} from './billingContracts.js'
export { matchesServerCode, unwrapServerCode } from './billingContracts.js'
export type { SessionBillingTransportOptions } from './transport.js'
export { createSessionBillingTransport } from './transport.js'
export type { CredentialedBillingTransportOptions } from './credentialedTransport.js'
export { createCredentialedBillingTransport } from './credentialedTransport.js'
export type { BillingScope, BillingScopeSource } from './billingScope.js'
export { sessionBillingScopeSource } from './billingScope.js'
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
export type {
  BillingPlansData,
  PlansReadOptions,
  PlansReader,
  PlansReaderOptions,
  PlansScope,
  PlansSnapshot
} from './plans.js'
export { PLANS_ROUTE, createPlansReader } from './plans.js'
export type {
  PaymentMethodsReadOptions,
  PaymentMethodsReader,
  PaymentMethodsReaderOptions,
  PaymentMethodsScope,
  PaymentMethodsSnapshot,
  SavedPaymentMethod
} from './paymentMethods.js'
export {
  PAYMENT_METHODS_ROUTE,
  createPaymentMethodsReader
} from './paymentMethods.js'
export type {
  BillingStatusData,
  BillingStatusReader,
  BillingStatusReaderOptions,
  BillingStatusReadOptions,
  BillingStatusScope,
  BillingStatusSnapshot
} from './status.js'
export { BILLING_STATUS_ROUTE, createBillingStatusReader } from './status.js'
export type {
  BillingAuthenticationState,
  BillingDeclineReason,
  BillingOpStatus,
  BillingOperationEvent,
  BillingOperationIdentity,
  BillingOperationKind,
  BillingOperationPhase,
  BillingOperationServerPhase,
  BillingOperationState,
  BillingPresentation,
  BillingPresentationState,
  BillingRecoveryAction,
  EmbeddedChallenge,
  FailedBillingOperation,
  HostedBillingDestination,
  PendingBillingOperation
} from './operationState.js'
export {
  isTerminal,
  reduceBillingOperation,
  validateActionUrl
} from './operationState.js'
export {
  OPERATION_POLL_BUDGET,
  OPERATION_POLL_TIMING,
  hasExhaustedPollBudget,
  isParkedOnCustomer,
  nextPollDelayMs,
  pollBudgetMs
} from './operationPolicy.js'
export type {
  BillingOperationPointer,
  BillingOperationPointerStorage,
  OperationPointerStore
} from './operationPointer.js'
export {
  OPERATION_POINTER_MAX_AGE_MS,
  createOperationPointerStore,
  operationPointerKey
} from './operationPointer.js'
export type { PresentationRoutingInput } from './presentation.js'
export { selectBillingPresentation } from './presentation.js'
export type {
  BillingOperationFailureCategory,
  BillingOperationLifecycle,
  BillingOperationLifecycleOptions,
  BillingOperationTelemetryEvent,
  IssuedBillingOperation,
  PresentationSwitchOutcome
} from './operationLifecycle.js'
export {
  createBillingOperationLifecycle,
  operationRoute
} from './operationLifecycle.js'
export { BILLING_OPERATION_TELEMETRY_EVENT } from '../../telemetry.js'
export type {
  EmbeddedChallengeOutcome,
  EmbeddedChallengePort
} from './challengeDriver.js'
export { driveEmbeddedChallenge } from './challengeDriver.js'
export { readBillingErrorCode } from './billingErrorBody.js'
export type {
  BillingCommands,
  BillingCommandsOptions,
  PaymentPortalResult,
  PreviewSubscribeInput,
  PreviewSubscribeOptions,
  PreviewSubscribeResult,
  SubscribeInput,
  SubscriptionCommandCode,
  SubscriptionCommandFailure,
  SubscriptionCommandOutcome,
  SubscriptionCommandResult,
  SubscriptionPreview,
  TerminalBillingOperation
} from './subscriptionCommands.js'
export {
  CANCEL_SUBSCRIPTION_ROUTE,
  PAYMENT_PORTAL_ROUTE,
  PREVIEW_SUBSCRIBE_ROUTE,
  RESUBSCRIBE_ROUTE,
  SUBSCRIBE_ROUTE,
  createBillingCommands
} from './subscriptionCommands.js'
export type {
  HostPaymentStep,
  PaymentProjection,
  PaymentReasonKey,
  PaymentStep
} from './paymentProjection.js'
export { projectPaymentStep } from './paymentProjection.js'
export type { PaymentCopyKey, PaymentCopyKeys } from './paymentCopy.js'
export {
  DEFAULT_PAYMENT_COPY,
  createPaymentCopy,
  paymentCopyKeys
} from './paymentCopy.js'
export type {
  CreateHostedTopupCheckoutInput,
  CreateTopupCheckoutInput,
  HostedTopupCheckout,
  HostedTopupCheckoutFailure,
  HostedTopupCheckoutResult,
  TopupCommand,
  TopupCommandOptions,
  TopupDeclined,
  TopupDenied,
  TopupFailure,
  TopupInvalidAmount,
  TopupInvalidReturnUrl,
  TopupNoPaymentMethod,
  TopupNotAvailable,
  TopupResult,
  TopupSucceeded,
  TopupUnsettled
} from './topup.js'
export {
  TOPUP_CHECKOUT_ROUTE,
  TOPUP_ROUTE,
  createTopupCommand
} from './topup.js'
export type {
  BalanceWatch,
  BalanceWatchOptions,
  BalanceWatchOutcome
} from './balanceWatch.js'
export {
  BALANCE_WATCH_LIFETIME_MS,
  BALANCE_WATCH_MAX_SCHEDULED_RUNS,
  BALANCE_WATCH_RETRY_GAPS_MS,
  createBalanceWatch
} from './balanceWatch.js'
