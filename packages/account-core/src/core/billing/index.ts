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
} from './billingContracts'
export { matchesServerCode, unwrapServerCode } from './billingContracts'
export type { SessionBillingTransportOptions } from './transport'
export { createSessionBillingTransport } from './transport'
export type {
  CredentialedBillingTransportOptions,
  CredentialedWebSession
} from './credentialedTransport'
export { createCredentialedBillingTransport } from './credentialedTransport'
export type { BillingScope, BillingScopeSource } from './billingScope'
export { sessionBillingScopeSource } from './billingScope'
export type {
  BillingCapabilities,
  CapabilitiesReadOptions,
  CapabilitiesReader,
  CapabilitiesReaderOptions,
  CapabilitiesSnapshot,
  CapabilityRolloutDefaults,
  CapabilityScope
} from './capabilities'
export {
  CAPABILITIES_ROUTE,
  CAPABILITY_REVISION_HEADER,
  createCapabilitiesReader,
  readCapabilityRevision
} from './capabilities'
export type {
  CapabilityDenialReason,
  CapabilityDenials
} from './capabilityDenials'
export { decodeCapabilityDenials } from './capabilityDenials'
export type {
  BillingBalance,
  CreditsReadOptions,
  CreditsReader,
  CreditsReaderOptions,
  CreditsScope,
  CreditsSnapshot
} from './credits'
export { CREDITS_ROUTE, createCreditsReader } from './credits'
export type {
  BillingEvent,
  BillingEventsData,
  BillingEventsReader,
  BillingEventsReaderOptions,
  BillingEventsReadOptions,
  BillingEventsScope,
  BillingEventsSnapshot
} from './events'
export { BILLING_EVENTS_ROUTE, createBillingEventsReader } from './events'
export type {
  BillingPlansData,
  PlansReadOptions,
  PlansReader,
  PlansReaderOptions,
  PlansScope,
  PlansSnapshot
} from './plans'
export { PLANS_ROUTE, createPlansReader } from './plans'
export type {
  WorkspaceInvite,
  WorkspaceInviteCommands
} from './workspaceInvites'
export {
  WORKSPACE_INVITES_ROUTE,
  createWorkspaceInviteCommands
} from './workspaceInvites'
export type {
  PaymentMethodsReadOptions,
  PaymentMethodsReader,
  PaymentMethodsReaderOptions,
  PaymentMethodsScope,
  PaymentMethodsSnapshot,
  SavedPaymentMethod
} from './paymentMethods'
export {
  PAYMENT_METHODS_ROUTE,
  createPaymentMethodsReader
} from './paymentMethods'
export type {
  BillingStatusData,
  BillingStatusReader,
  BillingStatusReaderOptions,
  BillingStatusReadOptions,
  BillingStatusScope,
  BillingStatusSnapshot
} from './status'
export { BILLING_STATUS_ROUTE, createBillingStatusReader } from './status'
export type {
  BillingAuthenticationState,
  BillingChargeBreakdown,
  BillingChargeReason,
  BillingDeclineReason,
  BillingOpStatus,
  BillingOperationEvent,
  BillingOperationIdentity,
  BillingOperationPlan,
  BillingOperationReceipt,
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
  PendingBillingOperation,
  SucceededBillingOperation
} from './operationState'
export {
  isBlockedOnCustomerPhase,
  isGrantLanding,
  isTerminal,
  reduceBillingOperation,
  validateActionUrl
} from './operationState'
export {
  OPERATION_POLL_BUDGET,
  OPERATION_POLL_TIMING,
  customerCanActHere,
  hasExhaustedPollBudget,
  isParkedOnCustomer,
  nextPollDelayMs,
  pendingOperationActionHold,
  pollBudgetMs
} from './operationPolicy'
export type { CustomerActionHold } from './operationPolicy'
export type {
  BillingOperationPointer,
  BillingOperationPointerStorage,
  OperationPointerStore
} from './operationPointer'
export {
  OPERATION_POINTER_MAX_AGE_MS,
  createOperationPointerStore,
  operationPointerKey
} from './operationPointer'
export type { PresentationRoutingInput } from './presentation'
export { selectBillingPresentation } from './presentation'
export type {
  BillingOperationFailureCategory,
  BillingOperationLifecycle,
  BillingOperationLifecycleOptions,
  BillingOperationTelemetryEvent,
  BillingRecoverOptions,
  IssuedBillingOperation,
  PresentationSwitchOutcome
} from './operationLifecycle'
export {
  createBillingOperationLifecycle,
  failureCategoryFor,
  operationRoute
} from './operationLifecycle'
export {
  BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT,
  BILLING_OPERATION_TELEMETRY_EVENT
} from '#/telemetry'
export * from './telemetry/index'
export type {
  EmbeddedChallengeOutcome,
  EmbeddedChallengePort
} from './challengeDriver'
export { driveEmbeddedChallenge } from './challengeDriver'
export {
  readBillingErrorCode,
  readBillingErrorMessage
} from './billingErrorBody'
export type {
  BillingCommands,
  BillingCommandsOptions,
  CancelOperationResult,
  CancelRefusalCode,
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
} from './subscriptionCommands'
export {
  CANCEL_SUBSCRIPTION_ROUTE,
  PAYMENT_PORTAL_ROUTE,
  PREVIEW_SUBSCRIBE_ROUTE,
  RESUBSCRIBE_ROUTE,
  SUBSCRIBE_ROUTE,
  createBillingCommands
} from './subscriptionCommands'
export type {
  HostPaymentStep,
  PaymentProjection,
  PaymentReasonKey,
  PaymentStep
} from './paymentProjection'
export { awaitsHostedAction, projectPaymentStep } from './paymentProjection'
export type {
  DeclineDetailKey,
  PaymentCopyKey,
  PaymentCopyKeys
} from './paymentCopy'
export {
  DEFAULT_PAYMENT_COPY,
  createPaymentCopy,
  declineDetailKey,
  paymentCopyKeys
} from './paymentCopy'
export type {
  CreateHostedTopupCheckoutInput,
  CreateInteractiveTopupInput,
  CreateTopupCheckoutInput,
  HostedTopupCheckout,
  HostedTopupCheckoutFailure,
  HostedTopupCheckoutResult,
  InteractiveTopupPayment,
  QuoteTopupInput,
  TopupCommand,
  TopupCommandOptions,
  TopupDeclined,
  TopupDenied,
  TopupFailure,
  TopupInvalidAmount,
  TopupInvalidReturnUrl,
  TopupNoPaymentMethod,
  TopupNotAvailable,
  TopupQuote,
  TopupQuoteResult,
  TopupResult,
  TopupSucceeded,
  TopupUnsettled
} from './topup'
export {
  INTERACTIVE_TOPUP_ROUTE,
  TOPUP_CHECKOUT_ROUTE,
  TOPUP_QUOTE_ROUTE,
  TOPUP_ROUTE,
  createTopupCommand
} from './topup'
export type {
  BalanceWatch,
  BalanceWatchOptions,
  BalanceWatchOutcome
} from './balanceWatch'
export {
  BALANCE_WATCH_LIFETIME_MS,
  BALANCE_WATCH_MAX_SCHEDULED_RUNS,
  BALANCE_WATCH_RETRY_GAPS_MS,
  createBalanceWatch
} from './balanceWatch'
