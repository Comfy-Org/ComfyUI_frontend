import { useRoute, useRouter } from 'vue-router'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import type { TeamCreditStops } from '@/platform/workspace/api/workspaceApi'
import type { SubscriptionCheckoutSelection } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.PRICING

function isCheckoutTier(
  value: string
): value is Extract<
  SubscriptionCheckoutSelection,
  { planMode: 'personal' }
>['tierKey'] {
  return value === 'standard' || value === 'creator' || value === 'pro'
}

function isBillingCycle(
  value: unknown
): value is SubscriptionCheckoutSelection['billingCycle'] {
  return value === 'monthly' || value === 'yearly'
}

function getCheckoutSelection(
  pricing: string,
  stop: unknown,
  cycle: unknown,
  teamCreditStops: TeamCreditStops | null
): SubscriptionCheckoutSelection | undefined {
  if (isCheckoutTier(pricing)) {
    if (stop !== undefined || !isBillingCycle(cycle)) return

    return {
      planMode: 'personal',
      tierKey: pricing,
      billingCycle: cycle
    }
  }

  if (
    pricing !== 'team' ||
    typeof stop !== 'string' ||
    !stop ||
    !isBillingCycle(cycle)
  ) {
    return
  }

  const catalogStop = teamCreditStops?.stops.find(
    (candidate) => candidate.id === stop
  )
  if (!catalogStop) return

  return {
    planMode: 'team',
    stop: {
      id: catalogStop.id,
      credits: catalogStop.credits,
      usd: catalogStop[cycle].list_price_cents / 100,
      discountedUsd: catalogStop[cycle].price_cents / 100
    },
    billingCycle: cycle
  }
}

/**
 * Opens the pricing table from a `?pricing=` deep link, to send pilot users
 * straight to subscribe. Values: `1` (default tab), `team`, `personal`, or a
 * selected personal tier or Team credit stop with a billing cycle to open its
 * confirmation.
 *
 * Gated to workspace owners (`canManageSubscription`); a member is a silent
 * no-op with the param stripped. Survives the login redirect via the
 * preserved-query system, like the invite URL loader.
 */
export function usePricingTableUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const subscriptionDialog = useSubscriptionDialog()
  const { teamCreditStops, fetchPlans } = useBillingContext()
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
    delete cleanQuery.stop
    delete cleanQuery.cycle
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

    if (!permissions.value.canManageSubscription) return

    const isPlainTeamLink =
      param === 'team' && query.stop === undefined && query.cycle === undefined
    const needsTeamCatalog = param === 'team' && !isPlainTeamLink
    if (needsTeamCatalog && !teamCreditStops.value) await fetchPlans()

    const initialCheckout = getCheckoutSelection(
      param,
      query.stop,
      query.cycle,
      teamCreditStops.value
    )
    if ((isCheckoutTier(param) || needsTeamCatalog) && !initialCheckout) return
    if (
      !initialCheckout &&
      (query.stop !== undefined || query.cycle !== undefined)
    ) {
      return
    }

    const planMode = initialCheckout
      ? initialCheckout.planMode
      : param === 'team' || param === 'personal'
        ? param
        : undefined

    if (!initialCheckout && !['1', 'team', 'personal'].includes(param)) return

    subscriptionDialog.showPricingTable({
      reason: 'deep_link',
      planMode,
      initialCheckout
    })
  }

  return {
    loadPricingTableFromUrl
  }
}
