import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { BillingType } from './types'

/**
 * Selects the billing backend for the active workspace: legacy user-scoped
 * (`/customers/*`) or workspace-scoped (`/api/billing/*`). Personal workspaces
 * stay legacy until `consolidatedBillingEnabled`, and known legacy Stripe
 * workspaces remain legacy after it is enabled. An unknown rail keeps the
 * flag-based route so workspace status can load it. Team workspaces are always
 * workspace-scoped. The routing matrix is covered in useBillingRouting.test.ts.
 */
export function useBillingRouting() {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()

  const type = computed<BillingType>(() => {
    if (!flags.teamWorkspacesEnabled) return 'legacy'

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

  return { type, shouldUseWorkspaceBilling }
}
