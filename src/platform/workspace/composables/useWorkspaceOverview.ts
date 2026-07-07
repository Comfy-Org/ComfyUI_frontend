import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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

const SNAPSHOT_SIZE = 4

export function useWorkspaceOverview() {
  const { t } = useI18n()
  const store = useTeamWorkspaceStore()
  const { members } = storeToRefs(store)

  const nextRenewal = new Date()
  nextRenewal.setDate(nextRenewal.getDate() + 20)
  const plan = {
    name: 'Team',
    priceCents: 32000,
    renewalLabel: nextRenewal.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const nextInvoiceCents = 32000

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

  return { plan, nextInvoiceCents, topSpenders, recentActivity }
}
