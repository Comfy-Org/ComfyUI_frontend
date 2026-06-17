import { isCloud } from '@/platform/distribution/types'
import type { PromptResponse } from '@/schemas/apiSchema'

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

// The subscription modal no-ops unless cloud subscription mode is enabled, so a
// subscription precondition can only be routed to a modal in that case. Sign-in
// and credit modals always render, so they can always be routed.
export function canRoutePreconditionToModal(
  precondition: AccountPrecondition
): boolean {
  return precondition === 'subscription'
    ? Boolean(isCloud && window.__CONFIG__?.subscription_required)
    : true
}

// The /prompt body is unvalidated JSON, so the error field may be a string, a
// structured payload, or absent (e.g. the 403 `{ message }` shape).
export function resolvePromptResponsePrecondition(
  responseError: PromptResponse['error'] | undefined
): AccountPrecondition | undefined {
  if (typeof responseError === 'string') {
    return resolveAccountPrecondition({
      exceptionType: '',
      exceptionMessage: responseError
    })
  }
  if (!responseError || typeof responseError !== 'object') return undefined
  return resolveAccountPrecondition({
    exceptionType: responseError.type ?? '',
    exceptionMessage: responseError.message ?? ''
  })
}
