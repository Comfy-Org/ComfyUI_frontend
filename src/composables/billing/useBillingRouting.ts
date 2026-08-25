import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { getBillingRailPolicy } from './billingRailPolicy'
import type { BillingType } from './types'

/**
 * Selects the billing backend for the active workspace: legacy user-scoped
 * (`/customers/*`) or workspace-scoped (`/api/billing/*`). Personal workspaces
 * use workspace billing unless an explicit legacy Stripe rail selects legacy
 * account operations and its migration flag is off. An unloaded workspace
 * remains legacy during bootstrap; Local/Desktop uses workspace billing after
 * its Cloud-backed workspace context loads.
 */
export function useBillingRouting() {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()

  const shouldUseUnifiedPricing = computed(() => {
    return isCloud && workspaceStore.activeWorkspace?.type !== undefined
  })

  const type = computed<BillingType>(() => {
    const workspaceType = workspaceStore.activeWorkspace?.type
    if (!workspaceType) return 'legacy'

    if (
      workspaceType === 'personal' &&
      getBillingRailPolicy(workspaceStore.activeWorkspaceBillingRail)
        .usesLegacyAccountOperations &&
      !flags.legacyBillingMigrationEnabled
    ) {
      return 'legacy'
    }

    return 'workspace'
  })

  const shouldUseWorkspaceBilling = computed(() => type.value === 'workspace')

  return { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing }
}
