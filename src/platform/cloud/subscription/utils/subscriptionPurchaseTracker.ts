import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from './subscriptionTierRank'

type PendingSubscriptionPurchase = {
  firebaseUid: string
  tierKey: TierKey
  billingCycle: BillingCycle
  timestamp: number
  previous_status?: SubscriptionStatusSnapshot
}

export type SubscriptionStatusSnapshot = {
  is_active?: boolean
  subscription_id?: string | null
  subscription_tier?: string | null
  subscription_duration?: string | null
}

const STORAGE_KEY = 'pending_subscription_purchase'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
const VALID_TIERS: TierKey[] = ['standard', 'creator', 'pro', 'founder']
const VALID_CYCLES: BillingCycle[] = ['monthly', 'yearly']

const safeRemove = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors (e.g. private browsing mode)
  }
}

export function startSubscriptionPurchaseTracking(
  tierKey: TierKey,
  billingCycle: BillingCycle,
  firebaseUid: string,
  previousStatus?: SubscriptionStatusSnapshot
): void {
  if (typeof window === 'undefined') return
  if (!firebaseUid) return
  try {
    const sanitizedStatus = previousStatus
      ? {
          ...(previousStatus.is_active !== undefined
            ? { is_active: previousStatus.is_active }
            : {}),
          ...(previousStatus.subscription_id
            ? { subscription_id: previousStatus.subscription_id }
            : {}),
          ...(previousStatus.subscription_tier
            ? { subscription_tier: previousStatus.subscription_tier }
            : {}),
          ...(previousStatus.subscription_duration
            ? { subscription_duration: previousStatus.subscription_duration }
            : {})
        }
      : undefined
    const payload: PendingSubscriptionPurchase = {
      firebaseUid,
      tierKey,
      billingCycle,
      timestamp: Date.now(),
      ...(sanitizedStatus ? { previous_status: sanitizedStatus } : {})
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage errors (e.g. private browsing mode)
  }
}

export function getPendingSubscriptionPurchase(
  firebaseUid: string
): PendingSubscriptionPurchase | null {
  if (typeof window === 'undefined') return null
  if (!firebaseUid) return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as PendingSubscriptionPurchase
    if (!parsed || typeof parsed !== 'object') {
      safeRemove()
      return null
    }

    const {
      firebaseUid: storedUid,
      tierKey,
      billingCycle,
      timestamp,
      previous_status: previousStatus
    } = parsed
    if (
      storedUid !== firebaseUid ||
      !VALID_TIERS.includes(tierKey) ||
      !VALID_CYCLES.includes(billingCycle) ||
      typeof timestamp !== 'number'
    ) {
      safeRemove()
      return null
    }

    if (
      previousStatus &&
      (typeof previousStatus !== 'object' || Array.isArray(previousStatus))
    ) {
      safeRemove()
      return null
    }

    if (
      previousStatus?.is_active !== undefined &&
      typeof previousStatus.is_active !== 'boolean'
    ) {
      safeRemove()
      return null
    }

    if (
      previousStatus?.subscription_id !== undefined &&
      previousStatus.subscription_id !== null &&
      typeof previousStatus.subscription_id !== 'string'
    ) {
      safeRemove()
      return null
    }

    if (
      previousStatus?.subscription_tier !== undefined &&
      previousStatus.subscription_tier !== null &&
      typeof previousStatus.subscription_tier !== 'string'
    ) {
      safeRemove()
      return null
    }

    if (
      previousStatus?.subscription_duration !== undefined &&
      previousStatus.subscription_duration !== null &&
      typeof previousStatus.subscription_duration !== 'string'
    ) {
      safeRemove()
      return null
    }

    if (Date.now() - timestamp > MAX_AGE_MS) {
      safeRemove()
      return null
    }

    const normalizedPreviousStatus = previousStatus
      ? {
          ...(previousStatus.is_active !== undefined
            ? { is_active: previousStatus.is_active }
            : {}),
          ...(previousStatus.subscription_id
            ? { subscription_id: previousStatus.subscription_id }
            : {}),
          ...(previousStatus.subscription_tier
            ? { subscription_tier: previousStatus.subscription_tier }
            : {}),
          ...(previousStatus.subscription_duration
            ? { subscription_duration: previousStatus.subscription_duration }
            : {})
        }
      : undefined

    return {
      ...parsed,
      ...(normalizedPreviousStatus
        ? { previous_status: normalizedPreviousStatus }
        : {})
    }
  } catch {
    safeRemove()
    return null
  }
}

export function clearPendingSubscriptionPurchase(): void {
  if (typeof window === 'undefined') return
  safeRemove()
}
