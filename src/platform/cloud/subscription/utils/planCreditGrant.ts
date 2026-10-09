import {
  getTierCredits,
  toTierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  SubscriptionDuration,
  SubscriptionTier
} from '@/platform/workspace/api/workspaceApi'

export interface PlanCreditGrant {
  credits: number
  cycle: 'monthly' | 'yearly'
}

export function getPlanCreditGrant({
  tier,
  duration,
  teamMonthlyCredits
}: {
  tier: SubscriptionTier | null | undefined
  duration: SubscriptionDuration | null | undefined
  teamMonthlyCredits?: number | null
}): PlanCreditGrant | null {
  if (!tier) return null
  const tierKey = toTierKey(tier)
  const monthlyCredits =
    teamMonthlyCredits ?? (tierKey ? getTierCredits(tierKey) : null)
  if (!monthlyCredits) return null
  if (duration === 'ANNUAL')
    return { credits: monthlyCredits * 12, cycle: 'yearly' }
  if (duration === 'MONTHLY' || tierKey === 'founder')
    return { credits: monthlyCredits, cycle: 'monthly' }
  return null
}
