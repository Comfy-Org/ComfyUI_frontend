import { useI18n } from 'vue-i18n'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

const TIER_KEY_MAP: Record<string, string> = {
  FREE: 'free',
  STANDARD: 'standard',
  CREATOR: 'creator',
  PRO: 'pro',
  FOUNDER: 'founder',
  FOUNDERS_EDITION: 'founder'
}

interface WorkspaceSubscriptionInfo {
  isSubscribed: boolean
  subscriptionPlan: string | null
  subscriptionTier: SubscriptionTier | null
}

export function useWorkspaceTierLabel() {
  const { t } = useI18n()

  function formatTierName(
    tier: string | null | undefined,
    isYearly: boolean
  ): string {
    if (!tier) return ''
    const key = TIER_KEY_MAP[tier] ?? 'standard'
    const baseName = t(`subscription.tiers.${key}.name`)
    return isYearly
      ? t('subscription.tierNameYearly', { name: baseName })
      : baseName
  }

  function isYearlyPlan(planSlug: string | null): boolean {
    if (!planSlug) return false
    return planSlug.includes('YEARLY') || planSlug.includes('ANNUAL')
  }

  function getTierLabel(workspace: WorkspaceSubscriptionInfo): string | null {
    if (!workspace.isSubscribed) return null

    if (workspace.subscriptionTier) {
      return formatTierName(
        workspace.subscriptionTier,
        isYearlyPlan(workspace.subscriptionPlan)
      )
    }

    if (!workspace.subscriptionPlan) return null

    const planSlug = workspace.subscriptionPlan
    const tierMatch = Object.keys(TIER_KEY_MAP).find((tier) =>
      planSlug.startsWith(tier)
    )
    if (!tierMatch) return null

    return formatTierName(tierMatch, isYearlyPlan(planSlug))
  }

  return { formatTierName, getTierLabel }
}
