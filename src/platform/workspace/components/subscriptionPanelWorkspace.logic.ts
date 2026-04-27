import type {
  SubscriptionTier,
  TierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierCredits
} from '@/platform/cloud/subscription/constants/tierPricing'

export function getSubscriptionTierKey(
  tier: SubscriptionTier | null | undefined
): TierKey {
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
}

export function formatSubscriptionDate(date?: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatRefillsDate(date?: string | null): string {
  if (!date) return ''
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

export function getNextMonthInvoice(
  memberCount: number,
  tierPrice: number
): number {
  return memberCount * tierPrice
}

export function getPlanTotalCreditsValue(
  tierKey: TierKey,
  isYearly: boolean
): number | null {
  const credits = getTierCredits(tierKey)
  if (credits === null) return null
  return isYearly ? credits * 12 : credits
}
