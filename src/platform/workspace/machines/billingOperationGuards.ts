import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

import type { BillingOperationContext } from './billingOperationContext'
import {
  SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS,
  SUBSCRIPTION_AUTHENTICATION_TIMEOUT_MS,
  TIMEOUT_MS
} from './billingOperationContext'

/**
 * A subscription gets a short window to produce a payment action, then a long
 * one to let a person complete it. Everything else gets a single flat budget.
 */
export function timeoutBudgetMs(
  operation: Pick<
    BillingOperationContext,
    'type' | 'authenticationRequiredSeen'
  >
): number {
  if (operation.type !== 'subscription') return TIMEOUT_MS
  return operation.authenticationRequiredSeen
    ? SUBSCRIPTION_AUTHENTICATION_TIMEOUT_MS
    : SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS
}

export function hasTimedOut(context: BillingOperationContext): boolean {
  return context.readNow() - context.startedAt > timeoutBudgetMs(context)
}

export function isSucceeded(response: BillingOpStatusResponse): boolean {
  return response.status === 'succeeded'
}

export function isFailed(response: BillingOpStatusResponse): boolean {
  return response.status === 'failed'
}
