import { useRoute, useRouter } from 'vue-router'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.TOPUP

/**
 * Opens the credit top-up dialog from a `?topup=1` deep link, to send existing
 * paid users straight to buying more credits (lifecycle emails).
 *
 * Gated to users who can top up (`canTopUp`: personal users and team owners);
 * a team member is a silent no-op with the param stripped. A lapsed or
 * free-tier user falls through to the subscription-required paywall inside
 * `showTopUpCreditsDialog`, keeping them in the purchase funnel. Survives the
 * login redirect via the preserved-query system, like the pricing URL loader.
 */
export function useTopUpUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const dialogService = useDialogService()
  const billingContext = useBillingContext()
  const { permissions } = useWorkspaceUI()

  /** Reads `?topup=`, strips it, and opens the dialog when the gate allows. */
  async function loadTopUpFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const param = query.topup
    if (param === undefined) return

    // Strip any present topup param (even ineligible or malformed values) and
    // write the clean URL in a single replace before any await, so a clean URL
    // is guaranteed even if the replace rejects or the gate later denies.
    const cleanQuery = { ...query }
    delete cleanQuery.topup
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn('[useTopUpUrlLoader] Failed to clean URL params:', error)
    })
    clearPreservedQuery(NAMESPACE)

    // Only a non-empty string value opens the dialog; an empty/array param
    // just gets stripped above.
    if (typeof param !== 'string' || !param) return

    // canTopUp derives from workspace type/role, which WorkspaceAuthGate
    // resolves before the app mounts, so it is readable synchronously here.
    if (!permissions.value.canTopUp) return

    // showTopUpCreditsDialog reads isActiveSubscription synchronously to pick
    // between the top-up dialog and the paywall; billing init on boot is
    // fire-and-forget, so await a status fetch to make that read reflect the
    // server before deciding.
    await billingContext.fetchStatus()

    // A null subscription means the fetch did not actually resolve the state:
    // the legacy adapter swallows fetch failures instead of rejecting. Bail
    // out rather than route a possibly-subscribed user to the paywall.
    if (!billingContext.subscription.value) return

    // Mirrors the paywall branch inside showTopUpCreditsDialog so deep_link
    // telemetry only counts opens of the actual top-up dialog, matching the
    // other sources whose buttons render only for active paid users.
    const opensTopUpDialog =
      billingContext.isActiveSubscription.value &&
      !billingContext.isFreeTier.value
    if (opensTopUpDialog) {
      useTelemetry()?.trackAddApiCreditButtonClicked({ source: 'deep_link' })
    }

    await dialogService.showTopUpCreditsDialog()
  }

  return {
    loadTopUpFromUrl
  }
}
