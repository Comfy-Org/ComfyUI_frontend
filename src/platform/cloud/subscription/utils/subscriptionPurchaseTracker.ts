import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from './subscriptionTierRank'

type PendingSubscriptionPurchase = {
  tierKey: TierKey
  billingCycle: BillingCycle
  timestamp: number
}

const STORAGE_KEY = 'pending_subscription_purchase'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
const VALID_TIERS: TierKey[] = ['standard', 'creator', 'pro', 'founder']
const VALID_CYCLES: BillingCycle[] = ['monthly', 'yearly']

export function startSubscriptionPurchaseTracking(
  tierKey: TierKey,
  billingCycle: BillingCycle
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: PendingSubscriptionPurchase = {
      tierKey,
      billingCycle,
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage errors (e.g. private browsing mode)
  }
}

export function getPendingSubscriptionPurchase(): PendingSubscriptionPurchase | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as PendingSubscriptionPurchase
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    const { tierKey, billingCycle, timestamp } = parsed
    if (
      !VALID_TIERS.includes(tierKey) ||
      !VALID_CYCLES.includes(billingCycle) ||
      typeof timestamp !== 'number'
    ) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    if (Date.now() - timestamp > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return parsed
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearPendingSubscriptionPurchase(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
