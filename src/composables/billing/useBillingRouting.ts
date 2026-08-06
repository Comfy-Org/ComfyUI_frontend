import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { BillingType } from './types'

/**
 * Selects the billing backend for the active workspace: legacy user-scoped
 * (`/customers/*`) or workspace-scoped (`/api/billing/*`). Personal workspaces
 * stay legacy until consolidated billing is enabled; an explicit legacy Stripe
 * rail continues to use legacy account operations after enablement. An unloaded
 * workspace remains legacy during bootstrap, and OSS always uses legacy billing.
 */
export function useBillingRouting() {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()

  const shouldUseUnifiedPricing = computed(() => {
    if (!isCloud) return false

    const workspaceType = workspaceStore.activeWorkspace?.type
    if (!workspaceType) return false

    return workspaceType === 'team' || flags.consolidatedBillingEnabled
  })

  const type = computed<BillingType>(() => {
    if (!isCloud) return 'legacy'

    // An unloaded workspace has no type yet; stay legacy so bootstrap never
    // eagerly routes to workspace billing.
    const workspaceType = workspaceStore.activeWorkspace?.type
    if (!workspaceType) return 'legacy'

    if (
      workspaceType === 'personal' &&
      (!flags.consolidatedBillingEnabled ||
        workspaceStore.activeWorkspaceBillingRail === 'legacy_stripe')
    ) {
      return 'legacy'
    }

    return 'workspace'
  })

  const shouldUseWorkspaceBilling = computed(() => type.value === 'workspace')

  return { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing }
}
