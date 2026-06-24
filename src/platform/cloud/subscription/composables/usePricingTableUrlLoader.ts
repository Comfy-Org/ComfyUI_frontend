import { useRoute, useRouter } from 'vue-router'

import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.PRICING

/**
 * Opens the pricing table from a `?pricing=` deep link, to send pilot users
 * straight to subscribe. Values: `1` (default tab), `team`, `personal`.
 *
 * Gated to the original owner (`canManageSubscriptionLifecycle`); a member or
 * promoted owner is a silent no-op with the param stripped. Survives the login
 * redirect via the preserved-query system, like the invite URL loader.
 */
export function usePricingTableUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const subscriptionDialog = useSubscriptionDialog()
  const workspaceStore = useTeamWorkspaceStore()
  const { permissions } = useWorkspaceUI()

  /** Reads `?pricing=`, strips it, and opens the table when the gate allows. */
  async function loadPricingTableFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const param = query.pricing
    if (!param || typeof param !== 'string') return

    // Strip the param (even for ineligible users) and write the clean URL in a
    // single replace before any await, so a clean URL is guaranteed even if the
    // replace rejects or the gate later denies the user.
    const cleanQuery = { ...query }
    delete cleanQuery.pricing
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn(
        '[usePricingTableUrlLoader] Failed to clean URL params:',
        error
      )
    })
    clearPreservedQuery(NAMESPACE)

    // Fetch members (no-ops for personal) so the original-owner self-row loads
    // before the gate; fetchMembers awaits, ensureMembersLoaded can return early.
    await workspaceStore.fetchMembers()
    if (!permissions.value.canManageSubscriptionLifecycle) return

    const planMode =
      param === 'team' || param === 'personal' ? param : undefined

    useTelemetry()?.trackSubscription('modal_opened', { reason: 'deep_link' })
    subscriptionDialog.showPricingTable({ reason: 'deep_link', planMode })
  }

  return {
    loadPricingTableFromUrl
  }
}
