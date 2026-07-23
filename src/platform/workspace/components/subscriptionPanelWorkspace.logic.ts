import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'
import type { SubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'

export function resolveSubscriptionTierKey(
  tier: SubscriptionTier | null | undefined
): TierKey {
  if (!tier) return 'free'
  return TIER_TO_KEY[tier] ?? 'standard'
}

export function formatSubscriptionDate(
  isoDate: string | null | undefined,
  locale: string
): string {
  if (!isoDate) return ''
  return new Date(isoDate).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
