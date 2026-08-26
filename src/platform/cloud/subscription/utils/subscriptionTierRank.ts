import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  Plan,
  SubscriptionTier,
  TeamCreditStopSummary,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

export type BillingCycle = 'monthly' | 'yearly'

type RankedTierKey = Exclude<TierKey, 'founder' | 'free'>
type RankedPlanKey = `${BillingCycle}-${RankedTierKey}`

interface PlanDescriptor {
  tierKey: TierKey
  billingCycle: BillingCycle
}

const PLAN_ORDER: RankedPlanKey[] = [
  'yearly-pro',
  'yearly-creator',
  'yearly-standard',
  'monthly-pro',
  'monthly-creator',
  'monthly-standard'
]

const PLAN_RANK = PLAN_ORDER.reduce<Map<RankedPlanKey, number>>(
  (acc, plan, index) => acc.set(plan, index),
  new Map()
)

const toRankedPlanKey = (
  tierKey: TierKey,
  billingCycle: BillingCycle
): RankedPlanKey | null => {
  if (tierKey === 'founder' || tierKey === 'free') return null
  return `${billingCycle}-${tierKey}`
}

export const getPlanRank = ({
  tierKey,
  billingCycle
}: PlanDescriptor): number => {
  const planKey = toRankedPlanKey(tierKey, billingCycle)
  if (!planKey) return Number.POSITIVE_INFINITY

  return PLAN_RANK.get(planKey) ?? Number.POSITIVE_INFINITY
}

interface DowngradeCheckParams {
  current: PlanDescriptor
  target: PlanDescriptor
}

export const isPlanDowngrade = ({
  current,
  target
}: DowngradeCheckParams): boolean => {
  const currentRank = getPlanRank(current)
  const targetRank = getPlanRank(target)

  return targetRank > currentRank
}

interface SubscriptionUpgradeEligibility {
  currentTier: SubscriptionTier | null
  plans: Plan[]
  teamCreditStops: TeamCreditStops | null
  currentTeamCreditStop: TeamCreditStopSummary | null
}

function getPersonalTierRank(tier: SubscriptionTier | null): number | null {
  switch (tier) {
    case 'FREE':
      return 0
    case 'STANDARD':
      return 1
    case 'CREATOR':
      return 2
    case 'PRO':
      return 3
    case 'FOUNDERS_EDITION':
    case 'TEAM':
    case null:
      return null
  }
}

export function hasEligibleSubscriptionUpgrade({
  currentTier,
  plans,
  teamCreditStops,
  currentTeamCreditStop
}: SubscriptionUpgradeEligibility): boolean {
  if (currentTier === 'TEAM') {
    const stops = teamCreditStops?.stops
    if (!stops || !currentTeamCreditStop) return false
    const currentStop = stops.find(
      (stop) => stop.id === currentTeamCreditStop.id
    )
    if (!currentStop) return false
    return stops.some((stop) => stop.credits > currentStop.credits)
  }

  const currentRank = getPersonalTierRank(currentTier)
  if (currentRank === null) return false
  return plans.some((plan) => {
    if (!plan.availability.available) return false
    const targetRank = getPersonalTierRank(plan.tier)
    return targetRank !== null && targetRank > currentRank
  })
}
