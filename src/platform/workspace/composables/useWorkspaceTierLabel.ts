import { useI18n } from 'vue-i18n'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

const tierKeyMap: Record<string, string> = {
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
    const key = tierKeyMap[tier]
    if (!key) return ''
    const baseName = t(`subscription.tiers.${key}.name`)
    return isYearly
      ? t('subscription.tierNameYearly', { name: baseName })
      : baseName
  }

  function getTierLabel(workspace: WorkspaceSubscriptionInfo): string | null {
    if (!workspace.isSubscribed) return null

    if (workspace.subscriptionTier) {
      return formatTierName(workspace.subscriptionTier, false)
    }

    if (!workspace.subscriptionPlan) return null

    const planSlug = workspace.subscriptionPlan
    const tierMatch = Object.keys(tierKeyMap)
      .sort((a, b) => b.length - a.length)
      .find((tier) => planSlug === tier || planSlug.startsWith(`${tier}_`))
    if (!tierMatch) return null

    const isYearly = planSlug.includes('YEARLY') || planSlug.includes('ANNUAL')
    return formatTierName(tierMatch, isYearly)
  }

  return { formatTierName, getTierLabel }
}
