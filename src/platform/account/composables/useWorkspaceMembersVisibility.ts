import { computed } from 'vue'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { isCloud } from '@/platform/distribution/types'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

/**
 * Whether the actor may reach the workspace Members panel.
 *
 * The panel is an account surface, so hosts ask account whether to offer it
 * rather than reading billing capabilities themselves.
 *
 * No server fact answers viewing: `can_manage_members` gates the actions
 * inside the panel, and Cloud members who are not owners read the roster
 * while it is false. BE-24066 asks for the field that should answer this, and
 * `pendingServerFact` expires the stand-in once it ships. See
 * ADR-API-SERVER-FACTS-0042.
 */
export function useWorkspaceMembersVisibility() {
  const { canManageMembers } = useBillingCapabilities()

  const canViewMembers = computed(() =>
    pendingServerFact('BE-24066', isCloud || canManageMembers.value)
  )

  return { canViewMembers }
}
