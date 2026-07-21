import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { userBadgeColor } from '@/platform/workspace/utils/badgeColor'
import { formatRelativeTime } from '@/platform/workspace/utils/relativeTime'

export interface SnapshotRow {
  userName: string
  color: string
  lastActivity: string
  credits: number
}

// Upper bound on the snapshot pool; the tile shows as many of these as its
// height allows (see visibleSnapshotRows in WorkspaceOverviewContent).
const SNAPSHOT_SIZE = 6

export function useWorkspaceOverview() {
  const { t, d } = useI18n()
  const store = useTeamWorkspaceStore()
  const { members } = storeToRefs(store)
  const { subscription, renewalDate } = useBillingContext()
  const { allowanceTotalCredits } = useSubscriptionCredits()

  const renewalLabel = computed(() => {
    const raw = renewalDate.value
    if (!raw) return '—'
    return d(new Date(raw), { month: 'short', day: 'numeric', year: 'numeric' })
  })

  // The enterprise tier relabels the same team layout. 'ENTERPRISE' is a wire
  // tier not yet in the generated SubscriptionTier union, hence the cast.
  const plan = computed(() => ({
    name:
      (subscription.value?.tier as string | null) === 'ENTERPRISE'
        ? 'Enterprise'
        : 'Team',
    cycleCredits: allowanceTotalCredits.value ?? 0,
    billingPeriod:
      subscription.value?.duration === 'ANNUAL'
        ? t('workspacePanel.overview.perYear')
        : t('workspacePanel.overview.perMonth'),
    renewalLabel: renewalLabel.value
  }))

  function activityLabel(member: WorkspaceMember): string {
    if (!member.lastActivity) return '—'
    return formatRelativeTime(member.lastActivity, new Date(), {
      justNow: t('workspacePanel.members.activity.justNow'),
      minutesAgo: (n) => t('workspacePanel.members.activity.minutesAgo', { n }),
      hoursAgo: (n) => t('workspacePanel.members.activity.hoursAgo', { n }),
      daysAgo: (n) => t('workspacePanel.members.activity.daysAgo', n)
    })
  }

  function toRow(member: WorkspaceMember): SnapshotRow {
    return {
      userName: member.name,
      color: userBadgeColor(member.name || member.email),
      lastActivity: activityLabel(member),
      credits: member.creditsUsedThisMonth ?? 0
    }
  }

  const topSpenders = computed(() =>
    [...members.value]
      .sort(
        (a, b) => (b.creditsUsedThisMonth ?? 0) - (a.creditsUsedThisMonth ?? 0)
      )
      .slice(0, SNAPSHOT_SIZE)
      .map(toRow)
  )

  const recentActivity = computed(() =>
    [...members.value]
      .filter((member) => member.lastActivity)
      .sort(
        (a, b) =>
          (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0)
      )
      .slice(0, SNAPSHOT_SIZE)
      .map(toRow)
  )

  return { plan, topSpenders, recentActivity }
}
