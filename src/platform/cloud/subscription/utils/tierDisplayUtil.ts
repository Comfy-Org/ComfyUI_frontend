import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'

const EXTENDED_TIER_TO_KEY: Record<string, TierKey> = {
  ...TIER_TO_KEY,
  FOUNDER: 'founder'
}

export function formatTierName(
  tier: string | null | undefined,
  isYearly: boolean,
  t: (key: string, params?: Record<string, string>) => string
): string {
  if (!tier) return ''
  const key = EXTENDED_TIER_TO_KEY[tier] ?? 'standard'
  const baseName = t(`subscription.tiers.${key}.name`)
  return isYearly
    ? t('subscription.tierNameYearly', { name: baseName })
    : baseName
}
