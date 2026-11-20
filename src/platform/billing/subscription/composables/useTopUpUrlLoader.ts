import { useRoute, useRouter } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'

import {
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

/**
 * Opens the credit top-up dialog from a `?topup=1` deep link, to send existing
 * paid users straight to buying more credits (lifecycle emails).
 *
 * Gated to users who can top up; an ineligible user is a silent no-op with the
 * param stripped. Fails closed when the link's `?workspace=` was refused, so a
 * purchase never credits a workspace the link did not name. Survives the login
 * redirect via the preserved-query system, like the pricing URL loader.
 */
export function useTopUpUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const { showTopUpCreditsDialog } = useBillingDialogs()
  const { canTopUp, initialize } = useBillingCapabilities()
  const telemetry = useTelemetry()

  /** Reads `?topup=`, strips it, and opens the dialog when the gate allows. */
  async function loadTopUpFromUrl({ workspaceLinkRefused = false } = {}) {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const param = query.topup
    if (param === undefined) return

    const requested = typeof param === 'string' && param.length > 0
    const shouldOpen = requested && !workspaceLinkRefused
    if (shouldOpen) await initialize()

    const cleanQuery = { ...query }
    delete cleanQuery.topup
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn('[useTopUpUrlLoader] Failed to clean URL params:', error)
    })
    clearPreservedQuery(NAMESPACE)

    if (requested && workspaceLinkRefused) {
      useToast().info(t('workspace.deepLinkTopUpRefused'))
      return
    }
    if (!shouldOpen) return
    if (!canTopUp.value) return

    telemetry?.trackAddApiCreditButtonClicked({ source: 'deep_link' })

    void showTopUpCreditsDialog({
      source: paymentIntentSourceForAddCreditsClick('deep_link')
    })
  }

  return {
    loadTopUpFromUrl
  }
}
