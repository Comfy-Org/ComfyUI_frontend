import { useRoute, useRouter } from 'vue-router'

import {
  capturePreservedQuery,
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTelemetry } from '@comfyorg/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.TOPUP
const OUT_OF_CREDITS = 'out_of_credits'

/**
 * Carries an out-of-credits top-up across a workspace switch's page reload,
 * so the next boot opens it in the workspace the switch landed in.
 */
export function setOutOfCreditsTopUpResume(resume: boolean): void {
  if (resume)
    capturePreservedQuery(NAMESPACE, { topup: OUT_OF_CREDITS }, ['topup'])
  else clearPreservedQuery(NAMESPACE)
}

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
  const { showTopUpCreditsDialog } = useBillingDialogs()
  const { canTopUp, initialize } = useBillingCapabilities()
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

    if (!canTopUp.value) return

    if (param === OUT_OF_CREDITS) {
      void showTopUpCreditsDialog({ isInsufficientCredits: true })
      return
    }

    telemetry?.trackAddApiCreditButtonClicked({ source: 'deep_link' })

    void showTopUpCreditsDialog({
      source: paymentIntentSourceForAddCreditsClick('deep_link')
    })
  }

  return {
    loadTopUpFromUrl
  }
}
