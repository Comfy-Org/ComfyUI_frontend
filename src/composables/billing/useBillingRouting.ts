import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { BillingType } from './types'

/**
 * Selects the billing backend for the active workspace: legacy user-scoped
 * (`/customers/*`) or workspace-scoped (`/api/billing/*`). Personal workspaces
 * use workspace billing unless an explicit legacy Stripe rail selects legacy
 * account operations and its migration flag is off. An unloaded workspace
 * remains legacy during bootstrap; Local/Desktop uses workspace billing after
 * its Cloud-backed workspace context loads.
 *
 * `type` selects the *account* operations — status, balance, top-up — which
 * must stay on the rail the account actually bills on: the backend rejects a
 * workspace-rail top-up for a legacy Stripe account. `shouldUseUnifiedPricing`
 * selects *checkout* — catalog, preview, subscribe — which is always the
 * workspace rail once a workspace exists, on every distribution. A legacy
 * Stripe workspace therefore runs the documented mixed state, and it has to
 * hold off Cloud too: the migration flag comes from Cloud remote config, so
 * Local/Desktop reads it as permanently off and would otherwise strand every
 * legacy Stripe personal workspace on the legacy adapter, whose `subscribe`
 * launches the account-scoped Stripe shortlink and whose `previewSubscribe`
 * returns null.
 */
export function useBillingRouting() {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()

  const shouldUseUnifiedPricing = computed(() => {
    return workspaceStore.activeWorkspace?.type !== undefined
  })

  const type = computed<BillingType>(() => {
    const workspaceType = workspaceStore.activeWorkspace?.type
    if (!workspaceType) return 'legacy'

    if (
      workspaceType === 'personal' &&
      workspaceStore.activeWorkspaceBillingRail === 'legacy_stripe' &&
      !flags.legacyBillingMigrationEnabled
    ) {
      return 'legacy'
    }

    return 'workspace'
  })

  const shouldUseWorkspaceBilling = computed(() => type.value === 'workspace')

  return { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing }
}
