import { computed } from 'vue'

import { userBadgeColor } from '@/platform/workspace/utils/badgeColor'

// Prototype mock for the Plan & Credits > Overview tab. There is no single
// endpoint for this rollup yet, so the shape is assembled client-side.

export interface SnapshotRow {
  userName: string
  color: string
  lastActivity: string
  credits: number
}

const TOP_SPENDERS: Array<[string, string, number]> = [
  ['Yuta', '3 hr ago', 1280],
  ['Jane', '7 hr ago', 124],
  ['Rob', '9 hr ago', 513],
  ['Min', '1 day ago', 124]
]

const RECENT_ACTIVITY: Array<[string, string, number]> = [
  ['Rob', '9 hr ago', 513],
  ['Yuta', '3 hr ago', 1280],
  ['Min', '1 day ago', 124],
  ['Jane', '7 hr ago', 124]
]

function toRows(raw: Array<[string, string, number]>): SnapshotRow[] {
  return raw.map(([userName, lastActivity, credits]) => ({
    userName,
    color: userBadgeColor(userName),
    lastActivity,
    credits
  }))
}

export function useWorkspaceOverview() {
  const plan = {
    name: 'Team',
    priceCents: 32000,
    renewalLabel: 'Jan 20, 2026'
  }

  const credits = {
    remaining: 49450,
    monthlyUsed: 7450,
    monthlyTotal: 56900,
    refillLabel: 'Feb 20',
    additional: 0
  }

  const monthlyLeft = computed(() => credits.monthlyTotal - credits.monthlyUsed)
  const monthlyProgress = computed(
    () => credits.monthlyUsed / credits.monthlyTotal
  )

  const nextInvoiceCents = 32000

  const topSpenders = toRows(TOP_SPENDERS)
  const recentActivity = toRows(RECENT_ACTIVITY)

  return {
    plan,
    credits,
    monthlyLeft,
    monthlyProgress,
    nextInvoiceCents,
    topSpenders,
    recentActivity
  }
}
