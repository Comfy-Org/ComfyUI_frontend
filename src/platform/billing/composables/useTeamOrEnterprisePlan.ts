import { computed } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

/**
 * Whether the active workspace is on a Team or Enterprise plan, the plans
 * that have members. False on an individual plan and while the plan loads.
 */
export function useTeamOrEnterprisePlan() {
  const { isTeamPlan, tier } = useBillingContext()
  return computed(() =>
    pendingServerFact(
      'BE-20674',
      isTeamPlan.value || tier.value === 'ENTERPRISE'
    )
  )
}
