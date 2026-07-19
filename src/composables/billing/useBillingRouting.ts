import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { BillingType } from './types'

/**
 * Selects the billing backend for the active workspace: legacy user-scoped
 * (`/customers/*`) or workspace-scoped (`/api/billing/*`). Personal workspaces
 * stay legacy until either billing rollout is enabled; team workspaces are
 * always workspace-scoped. The routing matrix is covered in
 * useBillingRouting.test.ts.
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
      !flags.consolidatedBillingEnabled &&
      !flags.billingControlEnabled
    ) {
      return 'legacy'
    }

    return 'workspace'
  })

  const shouldUseWorkspaceBilling = computed(() => type.value === 'workspace')

  return { type, shouldUseWorkspaceBilling }
}
