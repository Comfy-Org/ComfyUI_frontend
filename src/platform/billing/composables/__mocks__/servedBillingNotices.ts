export interface ServedNoticePlan {
  isTeamPlan: boolean
  tier?: string | null
  isCancelled?: boolean
  endDate?: string | null
}

const ENDING_NOTICE_LEAD_MS = 14 * 24 * 60 * 60 * 1000

/** The `billing_notice_audience` billing-api serves for `plan`. */
export function servedBillingNoticeAudience(plan: ServedNoticePlan) {
  if (plan.tier === 'ENTERPRISE') return 'none'
  if (plan.isTeamPlan) return 'team'
  return plan.tier ? 'personal' : 'none'
}

/** The `ending_notice_starts_at` billing-api serves for `plan`. */
export function servedEndingNoticeStartsAt(plan: ServedNoticePlan) {
  if (plan.tier !== 'ENTERPRISE' || !plan.isCancelled || !plan.endDate) {
    return null
  }
  return new Date(
    Date.parse(plan.endDate) - ENDING_NOTICE_LEAD_MS
  ).toISOString()
}
