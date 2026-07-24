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
 * workspace-scoped. Pricing follows feature availability independently of the
 * billing rail. The routing matrix is covered in useBillingRouting.test.ts.
 */
export function useBillingRouting() {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()

  const shouldUseUnifiedPricing = computed(() => {
    if (!flags.teamWorkspacesEnabled) return false

    const workspaceType = workspaceStore.activeWorkspace?.type
    if (!workspaceType) return false

    return workspaceType === 'team' || flags.consolidatedBillingEnabled
  })

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

  return { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing }
}
