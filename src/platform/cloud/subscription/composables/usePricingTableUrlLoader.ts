import { useRoute, useRouter } from 'vue-router'

import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
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
    if (param === undefined) return

    // Strip any present pricing param (even ineligible or malformed values) and
    // write the clean URL in a single replace before any await, so a clean URL
    // is guaranteed even if the replace rejects or the gate later denies.
    const cleanQuery = { ...query }
    delete cleanQuery.pricing
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn(
        '[usePricingTableUrlLoader] Failed to clean URL params:',
        error
      )
    })
    clearPreservedQuery(NAMESPACE)

    // Only a non-empty string value opens the table; an empty/array param just
    // gets stripped above.
    if (typeof param !== 'string' || !param) return

    // Load members before reading the gate so the original-owner self-row is
    // present. fetchMembers always awaits the request; ensureMembersLoaded can
    // early-return on a cached/in-flight load and let the gate read empty members.
    await workspaceStore.fetchMembers()
    if (!permissions.value.canManageSubscriptionLifecycle) return

    const planMode =
      param === 'team' || param === 'personal' ? param : undefined

    subscriptionDialog.showPricingTable({ reason: 'deep_link', planMode })
  }

  return {
    loadPricingTableFromUrl
  }
}
