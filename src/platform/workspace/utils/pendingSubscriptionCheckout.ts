import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'

const STORAGE_KEY = 'comfy:pending-subscription-checkout'
const MAX_AGE_MS = 24 * 60 * 60_000

type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>

type PendingSubscriptionSelection =
  | {
      planMode: 'personal'
      tierKey: CheckoutTierKey
      billingCycle: BillingCycle
    }
  | {
      planMode: 'team'
      teamCreditStopId: string
      billingCycle: BillingCycle
    }

export interface PendingSubscriptionCheckout {
  operationId: string
  workspaceId: string
  ownerUid: string
  selection: PendingSubscriptionSelection
  attemptedAt: number
}

const CHECKOUT_TIERS: readonly CheckoutTierKey[] = [
  'standard',
  'creator',
  'pro'
]

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === 'monthly' || value === 'yearly'
}

function isSelection(value: unknown): value is PendingSubscriptionSelection {
  if (!value || typeof value !== 'object') return false
  if (!('planMode' in value) || !('billingCycle' in value)) return false
  if (!isBillingCycle(value.billingCycle)) return false

  if (value.planMode === 'personal') {
    return (
      'tierKey' in value &&
      CHECKOUT_TIERS.some((tierKey) => tierKey === value.tierKey)
    )
  }

  return (
    value.planMode === 'team' &&
    'teamCreditStopId' in value &&
    isNonEmptyString(value.teamCreditStopId)
  )
}

function isPendingCheckout(
  value: unknown,
  now: number
): value is PendingSubscriptionCheckout {
  if (!value || typeof value !== 'object') return false
  if (
    !('operationId' in value) ||
    !isNonEmptyString(value.operationId) ||
    !('workspaceId' in value) ||
    !isNonEmptyString(value.workspaceId) ||
    !('ownerUid' in value) ||
    !isNonEmptyString(value.ownerUid) ||
    !('attemptedAt' in value) ||
    typeof value.attemptedAt !== 'number' ||
    !Number.isFinite(value.attemptedAt) ||
    value.attemptedAt > now ||
    now - value.attemptedAt > MAX_AGE_MS ||
    !('selection' in value)
  ) {
    return false
  }
  return isSelection(value.selection)
}

export function savePendingSubscriptionCheckout(
  checkout: PendingSubscriptionCheckout
): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(checkout))
  } catch {
    return
  }
}

export function getPendingSubscriptionCheckout(
  now = Date.now()
): PendingSubscriptionCheckout | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const checkout: unknown = JSON.parse(stored)
    if (isPendingCheckout(checkout, now)) return checkout
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      return null
    }
  }
  return null
}

export function clearPendingSubscriptionCheckout(operationId?: string): void {
  try {
    if (operationId) {
      const checkout = getPendingSubscriptionCheckout()
      if (checkout?.operationId !== operationId) return
    }
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

// A client-side `timeout` is this tab giving up, not the server finishing: an
// operation awaiting bank authentication stays pending for hours. Dropping the
// pointer there is the defect. `reconciliation_needed` does belong here — the
// contract calls it terminal for polling, and the store stops and resolves on
// it, so retaining the pointer would re-poll a settled operation every reload.
const SERVER_TERMINAL_STATUSES = [
  'succeeded',
  'failed',
  'reconciliation_needed'
]

export function clearPendingSubscriptionCheckoutIfTerminal(
  operationId: string,
  status: string
): void {
  if (!SERVER_TERMINAL_STATUSES.includes(status)) return
  clearPendingSubscriptionCheckout(operationId)
}
