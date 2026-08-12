import { computed } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { BillingType } from './types'

/**
 * Selects the billing backend for the active workspace: legacy user-scoped
 * (`/customers/*`) or workspace-scoped (`/api/billing/*`). Personal workspaces
 * use workspace billing unless an explicit legacy Stripe rail selects legacy
 * account operations. An unloaded workspace remains legacy during bootstrap,
 * and OSS always uses legacy billing.
 */
export function useBillingRouting() {
  const workspaceStore = useTeamWorkspaceStore()

  const shouldUseUnifiedPricing = computed(() => {
    return isCloud && workspaceStore.activeWorkspace?.type !== undefined
  })

  const type = computed<BillingType>(() => {
    if (!isCloud) return 'legacy'

    // An unloaded workspace has no type yet; stay legacy so bootstrap never
    // eagerly routes to workspace billing.
    const workspaceType = workspaceStore.activeWorkspace?.type
    if (!workspaceType) return 'legacy'

    if (
      workspaceType === 'personal' &&
      workspaceStore.activeWorkspaceBillingRail === 'legacy_stripe'
    ) {
      return 'legacy'
    }

    return 'workspace'
  })

  const shouldUseWorkspaceBilling = computed(() => type.value === 'workspace')

  return { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing }
}
