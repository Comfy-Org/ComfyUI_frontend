import type {
  SubscriptionTier,
  TierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'

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
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})T/.exec(isoDate)
  if (!calendarDate) return ''

  const [, year, month, day] = calendarDate
  const calendarCheck = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  )
  if (
    calendarCheck.getUTCFullYear() !== Number(year) ||
    calendarCheck.getUTCMonth() + 1 !== Number(month) ||
    calendarCheck.getUTCDate() !== Number(day)
  )
    return ''

  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
