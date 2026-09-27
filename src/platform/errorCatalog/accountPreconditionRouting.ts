import {
  INSUFFICIENT_CREDITS_CATALOG_ID,
  SIGN_IN_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID,
  WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID
} from './catalogIds'
import type { RuntimeErrorInfo } from './runtimeErrorMatcher'
import { resolveRuntimeCatalogMatch } from './runtimeErrorMatcher'

// Account preconditions are gating states (sign-in, subscription, credits) that
// must open their own modal instead of surfacing as a workflow error. They are
// excluded from the error panel and the error count.
export type AccountPrecondition = 'sign_in' | 'subscription' | 'credits'

const CATALOG_ID_TO_PRECONDITION = new Map<string, AccountPrecondition>([
  [SIGN_IN_REQUIRED_CATALOG_ID, 'sign_in'],
  [SUBSCRIPTION_REQUIRED_CATALOG_ID, 'subscription'],
  [SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID, 'subscription'],
  [INSUFFICIENT_CREDITS_CATALOG_ID, 'credits'],
  [WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID, 'credits']
])

export function preconditionForCatalogId(
  catalogId: string | undefined
): AccountPrecondition | undefined {
  if (!catalogId) return undefined
  return CATALOG_ID_TO_PRECONDITION.get(catalogId)
}

export function isAccountPreconditionCatalogId(
  catalogId: string | undefined
): boolean {
  return preconditionForCatalogId(catalogId) !== undefined
}

// Classifies a single runtime error payload into the account precondition it
// represents, or `undefined` when it is an ordinary workflow error.
export function resolveAccountPrecondition(
  info: RuntimeErrorInfo
): AccountPrecondition | undefined {
  const match = resolveRuntimeCatalogMatch(info)
  return preconditionForCatalogId(match?.catalogId)
}
