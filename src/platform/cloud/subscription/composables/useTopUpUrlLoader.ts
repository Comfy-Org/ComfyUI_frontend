import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTelemetry } from '@/platform/telemetry'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.TOPUP

/**
 * Opens the credit top-up dialog from a `?topup=1` deep link, to send existing
 * paid users straight to buying more credits (lifecycle emails).
 *
 * Gated to users who can top up; an ineligible user is a silent no-op with the
 * param stripped. Survives the login redirect via the preserved-query system,
 * like the pricing URL loader.
 */
export function useTopUpUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const dialogService = useDialogService()
  const { canTopUp, canSubscribeSelfServe, initialize } =
    useBillingCapabilities()
  const telemetry = useTelemetry()

  /** Reads `?topup=`, strips it, and opens the dialog when the gate allows. */
  async function loadTopUpFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const param = query.topup
    if (param === undefined) return

    const shouldOpen = typeof param === 'string' && param.length > 0
    if (shouldOpen) await initialize()

    // Strip any present topup param (even ineligible or malformed values) and
    // write the clean URL in a single replace once capability loading settles.
    const cleanQuery = { ...query }
    delete cleanQuery.topup
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn('[useTopUpUrlLoader] Failed to clean URL params:', error)
    })
    clearPreservedQuery(NAMESPACE)

    // Only a non-empty string value opens the dialog; an empty/array param
    // just gets stripped above.
    if (!shouldOpen) return

    if (!canTopUp.value && !canSubscribeSelfServe.value) return

    if (canTopUp.value) {
      telemetry?.trackAddApiCreditButtonClicked({ source: 'deep_link' })
    }

    void dialogService.showTopUpCreditsDialog()
  }

  return {
    loadTopUpFromUrl
  }
}
