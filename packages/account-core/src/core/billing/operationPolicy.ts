/**
 * The cadence and budget for observing one operation, taken from the cloud
 * app's `billingOperationStore` rather than invented, so a consumer moving
 * onto the SDK sees the same request rate and the same give-up points.
 */
import { isBlockedOnCustomerPhase } from './operationState.js'
import type { PendingBillingOperation } from './operationState.js'

export const OPERATION_POLL_TIMING = {
  initialMs: 1_000,
  maxMs: 8_000,
  multiplier: 1.5,
  /** An operation parked on the customer is checked on a slow, flat cadence. */
  parkedMs: 30_000,
  /** Fast backoff for an actionless blocked wait: 20 turns of the 3 s PI status cache. */
  actionDiscoveryMs: 60_000
} as const

export const OPERATION_POLL_BUDGET = {
  defaultMs: 120_000,
  /** A subscription may take minutes to discover that it needs the customer. */
  subscriptionDiscoveryMs: 5 * 60_000,
  /** Once the customer is involved, a bank challenge can idle for hours. */
  customerActionMs: 23 * 60 * 60_000
} as const

/**
 * Whether this tab holds something the customer can do right now: an embedded
 * challenge to open or retry, a hosted page to visit, or a declined attempt
 * to retry.
 */
function customerCanAct(state: PendingBillingOperation): boolean {
  if (state.declineReason !== undefined) return true
  if (state.presentation === 'hosted') return state.actionUrl !== undefined
  const challenge = state.challenge?.status
  return challenge === 'required' || challenge === 'failed'
}

/**
 * Waiting on the customer, not on the backend: a challenge to complete
 * elsewhere, a hosted page to finish, a phase the server reports as blocked on
 * them, or a declined attempt awaiting their retry. Once this tab's own
 * challenge completes the state reads processing and nothing waits on the
 * customer anymore.
 */
function isWaitingOnCustomer(state: PendingBillingOperation): boolean {
  return (
    state.authenticationState === 'requires_action' ||
    state.actionUrl !== undefined ||
    isBlockedOnCustomerPhase(state.serverPhase) ||
    (state.authenticationState === 'failed_retryable' &&
      state.customerActionSeen)
  )
}

/**
 * Parked only while the customer can act here. The server can report a
 * blocked phase and a client secret before its cached `authentication_state`
 * catches up, and the slow cadence would then hold a screen with no action.
 */
export function isParkedOnCustomer(state: PendingBillingOperation): boolean {
  return customerCanAct(state) && isWaitingOnCustomer(state)
}

/**
 * Blocked on the customer with nothing to offer them yet: either the action
 * is still on its way, or it belongs to someone else (a member without
 * billing permission, a tab without embedded checkout).
 */
export function isWaitingOnCustomerWithoutAction(
  state: PendingBillingOperation
): boolean {
  return !customerCanAct(state) && isWaitingOnCustomer(state)
}

/**
 * `waitedWithoutActionMs` is how long the operation has continuously been
 * {@link isWaitingOnCustomerWithoutAction}; past the discovery window it
 * parks too, so an action that never arrives here costs the slow cadence.
 */
export function nextPollDelayMs(
  state: PendingBillingOperation,
  previousDelayMs: number | undefined,
  waitedWithoutActionMs = 0
): number {
  if (isParkedOnCustomer(state)) return OPERATION_POLL_TIMING.parkedMs
  if (
    isWaitingOnCustomerWithoutAction(state) &&
    waitedWithoutActionMs >= OPERATION_POLL_TIMING.actionDiscoveryMs
  ) {
    return OPERATION_POLL_TIMING.parkedMs
  }
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
