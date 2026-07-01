import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { BillingType } from './types'

/**
 * Single source of truth for which billing flow the active workspace uses.
 *
 * Two flags gate the decision:
 * - `teamWorkspacesEnabled`: off (OSS/Desktop, always off outside Cloud) means
 *   legacy user-scoped billing (`/customers/*`) for everyone.
 * - `consolidatedBillingEnabled`: while off, PERSONAL workspaces stay on the
 *   legacy flow even when team workspaces are enabled; team workspaces always
 *   use the new workspace-scoped flow (`/api/billing/*`).
 *
 * The predicate deliberately keys on the concrete `activeWorkspace.type` rather
 * than the store's `isInPersonalWorkspace`, because a not-yet-loaded workspace
 * must not be treated as "team" and eagerly routed to workspace billing.
 *
 * | State                                                | Billing type |
 * | ---------------------------------------------------- | ------------ |
 * | Team workspaces disabled (OSS/Desktop)               | legacy       |
 * | Personal workspace, consolidated billing off/missing | legacy       |
 * | Personal workspace, consolidated billing on          | workspace    |
 * | Team workspace                                        | workspace    |
 * | Workspace not loaded yet                              | legacy       |
 */
export function useBillingRouting() {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()

  const shouldUseWorkspaceBilling = computed(() => {
    if (!flags.teamWorkspacesEnabled) return false

    const workspace = workspaceStore.activeWorkspace
    if (!workspace) return false

    return workspace.type !== 'personal' || flags.consolidatedBillingEnabled
  })

  const shouldUseLegacyBilling = computed(
    () => !shouldUseWorkspaceBilling.value
  )

  const type = computed<BillingType>(() =>
    shouldUseWorkspaceBilling.value ? 'workspace' : 'legacy'
  )

  return {
    type,
    shouldUseWorkspaceBilling,
    shouldUseLegacyBilling
  }
}
