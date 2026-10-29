import { computed } from 'vue'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { isCloud } from '@/platform/distribution/types'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

/**
 * Whether a host may offer the workspace Members panel.
 *
 * Not `can_manage_members`, which gates the actions inside the panel: Cloud
 * members who are not owners read the roster while it is false.
 */
export function useWorkspaceMembersVisibility() {
  const { canManageMembers } = useBillingCapabilities()

  const canViewMembers = computed<boolean>(() =>
    pendingServerFact('BE-24066', isCloud || canManageMembers.value)
  )

  return { canViewMembers }
}
