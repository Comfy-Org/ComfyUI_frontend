import { computed } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/**
 * Whether this user may choose the workspace default deployment: an owner on
 * a Team or Enterprise plan. Individual plans, and a plan not yet loaded,
 * have no members to start on it.
 */
export function useWorkspaceDefaultOffered() {
  const pickStore = useDeploymentPickStore()
  const { isTeamPlan, tier } = useBillingContext()
  return computed(
    () =>
      pickStore.canSetDefault &&
      pendingServerFact(
        'BE-20674',
        isTeamPlan.value || tier.value === 'ENTERPRISE'
      )
  )
}
