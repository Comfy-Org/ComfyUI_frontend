import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from './subscriptionTierRank'

type PendingSubscriptionPurchase = {
  firebaseUid: string
  tierKey: TierKey
  billingCycle: BillingCycle
  timestamp: number
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
  firebaseUid: string
): void {
  if (typeof window === 'undefined') return
  if (!firebaseUid) return
  try {
    const payload: PendingSubscriptionPurchase = {
      firebaseUid,
      tierKey,
      billingCycle,
      timestamp: Date.now()
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

    const { firebaseUid: storedUid, tierKey, billingCycle, timestamp } = parsed
    if (
      storedUid !== firebaseUid ||
      !VALID_TIERS.includes(tierKey) ||
      !VALID_CYCLES.includes(billingCycle) ||
      typeof timestamp !== 'number'
    ) {
      safeRemove()
      return null
    }

    if (Date.now() - timestamp > MAX_AGE_MS) {
      safeRemove()
      return null
    }

    return parsed
  } catch {
    safeRemove()
    return null
  }
}

export function clearPendingSubscriptionPurchase(): void {
  if (typeof window === 'undefined') return
  safeRemove()
}
