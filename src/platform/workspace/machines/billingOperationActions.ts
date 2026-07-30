import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

import type { BillingOperationContext } from './billingOperationContext'
import {
  ACTION_REQUIRED_INTERVAL_MS,
  BACKOFF_MULTIPLIER,
  MAX_INTERVAL_MS,
  validateActionUrl
} from './billingOperationContext'

/**
 * Backoff applies only until an action URL has been seen. From then on the
 * operation is waiting on a person rather than on the backend, so it settles
 * into a flat, slower cadence.
 */
export function nextIntervalMs(context: BillingOperationContext): number {
  if (context.authenticationRequiredSeen) return ACTION_REQUIRED_INTERVAL_MS
  return Math.min(context.intervalMs * BACKOFF_MULTIPLIER, MAX_INTERVAL_MS)
}

/**
 * `authenticationRequiredSeen` is sticky: a withdrawn action URL does not
 * return the operation to the short discovery budget.
 */
export function recordActionUrl(
  context: BillingOperationContext,
  response: BillingOpStatusResponse
): Pick<BillingOperationContext, 'actionUrl' | 'authenticationRequiredSeen'> {
  const actionUrl = validateActionUrl(response.action_url)
  return {
    actionUrl,
    authenticationRequiredSeen:
      context.authenticationRequiredSeen || actionUrl !== null
  }
}

export function recordFailure(
  response: BillingOpStatusResponse
): Pick<BillingOperationContext, 'backendErrorMessage'> {
  return { backendErrorMessage: response.error_message ?? null }
}
