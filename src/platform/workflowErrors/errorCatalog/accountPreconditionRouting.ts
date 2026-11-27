import {
  INSUFFICIENT_CREDITS_CATALOG_ID,
  PERSONAL_WALLET_INSUFFICIENT_CREDITS_CATALOG_ID,
  SIGN_IN_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID,
  WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID
} from './catalogIds'
import type { PromptError } from '@comfyorg/api-client/types'

import type { RuntimeErrorInfo } from './runtimeErrorMatcher'
import { resolveRuntimeCatalogMatch } from './runtimeErrorMatcher'

// Account preconditions are gating states (sign-in, subscription, credits) that
// must open their own modal instead of surfacing as a workflow error. They are
// excluded from the error panel and the error count.
export type AccountPrecondition =
  | 'sign_in'
  | 'subscription'
  | 'credits'
  | 'personal_wallet_session'
  | 'personal_wallet_api_key'

const CATALOG_ID_TO_PRECONDITION = new Map<string, AccountPrecondition>([
  [SIGN_IN_REQUIRED_CATALOG_ID, 'sign_in'],
  [SUBSCRIPTION_REQUIRED_CATALOG_ID, 'subscription'],
  [SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID, 'subscription'],
  [INSUFFICIENT_CREDITS_CATALOG_ID, 'credits'],
  [WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID, 'credits'],
  [PERSONAL_WALLET_INSUFFICIENT_CREDITS_CATALOG_ID, 'personal_wallet_session']
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
  if (
    match?.catalogId === PERSONAL_WALLET_INSUFFICIENT_CREDITS_CATALOG_ID &&
    match.params?.credential === 'api_key'
  )
    return 'personal_wallet_api_key'
  return preconditionForCatalogId(match?.catalogId)
}

/** Cloud's run refusal says the account holds credits a plan would unlock. */
export function promptErrorHasLockedCredits(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'credits_locked' in error &&
    error.credits_locked === true
  )
}

type PromptRefusal =
  | { precondition: AccountPrecondition }
  | { messageKey: string }

const REFUSAL_BY_REASON = new Map<string, PromptRefusal>([
  ['subscription_inactive', { precondition: 'subscription' }],
  ['no_funds', { precondition: 'credits' }],
  [
    'manual_block',
    { messageKey: 'subscription.plansLink.runRefusedManualBlock' }
  ],
  [
    'workspace_cap_exceeded',
    { messageKey: 'subscription.plansLink.runRefusedWorkspaceCap' }
  ],
  [
    'project_cap_exceeded',
    { messageKey: 'subscription.plansLink.runRefusedProjectCap' }
  ],
  [
    'user_cap_exceeded',
    { messageKey: 'subscription.plansLink.runRefusedUserCap' }
  ]
])

function servedRefusalReason(error: unknown): string | undefined {
  return error !== null &&
    typeof error === 'object' &&
    'reason' in error &&
    typeof error.reason === 'string'
    ? error.reason
    : undefined
}

function servedRefusal(error: unknown): PromptRefusal | undefined {
  const reason = servedRefusalReason(error)
  return reason === undefined ? undefined : REFUSAL_BY_REASON.get(reason)
}

/** The account precondition named by the `reason` Cloud serves on a run refusal. */
export function promptRefusalPrecondition(
  error: unknown
): AccountPrecondition | undefined {
  const refusal = servedRefusal(error)
  return refusal && 'precondition' in refusal ? refusal.precondition : undefined
}

/** The i18n key of the sentence for the `reason` Cloud serves on a run it blocks. */
export function promptRefusalMessageKey(error: unknown): string | undefined {
  const refusal = servedRefusal(error)
  return refusal && 'messageKey' in refusal ? refusal.messageKey : undefined
}

/** Carries the `reason` Cloud serves on a run refusal onto the prompt error. */
export function withRefusalReason(
  promptError: PromptError,
  served: unknown
): PromptError & { reason?: string } {
  const reason = servedRefusalReason(served)
  return reason === undefined ? promptError : { ...promptError, reason }
}
