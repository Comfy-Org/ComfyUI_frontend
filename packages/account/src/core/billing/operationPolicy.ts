/**
 * The cadence and budget for observing one operation, taken from the cloud
 * app's `billingOperationStore` rather than invented, so a consumer moving
 * onto the SDK sees the same request rate and the same give-up points.
 */
import type { PendingBillingOperation } from './operationState.js'

export const OPERATION_POLL_TIMING = {
  initialMs: 1_000,
  maxMs: 8_000,
  multiplier: 1.5,
  /** An operation parked on the customer is checked on a slow, flat cadence. */
  parkedMs: 30_000
} as const

export const OPERATION_POLL_BUDGET = {
  defaultMs: 120_000,
  /** A subscription may take minutes to discover that it needs the customer. */
  subscriptionDiscoveryMs: 5 * 60_000,
  /** Once the customer is involved, a bank challenge can idle for hours. */
  customerActionMs: 23 * 60 * 60_000
} as const

/**
 * Waiting on the customer, not on the backend: a challenge to complete
 * elsewhere, a hosted page to finish, or a declined attempt awaiting their
 * retry. Once this tab's own challenge completes the state reads processing
 * and nothing waits on the customer anymore.
 */
export function isParkedOnCustomer(state: PendingBillingOperation): boolean {
  return (
    state.authenticationState === 'requires_action' ||
    state.actionUrl !== undefined ||
    (state.authenticationState === 'failed_retryable' &&
      state.customerActionSeen)
  )
}

export function nextPollDelayMs(
  state: PendingBillingOperation,
  previousDelayMs: number | undefined
): number {
  if (isParkedOnCustomer(state)) return OPERATION_POLL_TIMING.parkedMs
  return Math.min(
    (previousDelayMs ?? OPERATION_POLL_TIMING.initialMs) *
      OPERATION_POLL_TIMING.multiplier,
    OPERATION_POLL_TIMING.maxMs
  )
}

export function pollBudgetMs(state: PendingBillingOperation): number {
  if (state.kind !== 'cancel' && state.customerActionSeen) {
    return OPERATION_POLL_BUDGET.customerActionMs
  }
  return state.kind === 'subscription'
    ? OPERATION_POLL_BUDGET.subscriptionDiscoveryMs
    : OPERATION_POLL_BUDGET.defaultMs
}

export function hasExhaustedPollBudget(
  state: PendingBillingOperation,
  now: number
): boolean {
  return now - state.observedAt > pollBudgetMs(state)
}
