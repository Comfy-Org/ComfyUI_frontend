import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'

import {
  capturePreservedQuery,
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTelemetry } from '@comfyorg/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/billing/utils/paymentIntentSource'
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

type TopUpLinkAction = 'none' | 'strip' | 'refuse' | 'open'

/** What a `?topup=` value asks for, given whether its workspace link was refused. */
export function topUpLinkAction({
  param,
  workspaceLinkRefused
}: {
  param: unknown
  workspaceLinkRefused: boolean
}): TopUpLinkAction {
  if (param === undefined) return 'none'
  if (typeof param !== 'string' || !param) return 'strip'
  return workspaceLinkRefused ? 'refuse' : 'open'
}

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

  function stripParam(query: LocationQueryRaw) {
    const cleanQuery = { ...query }
    delete cleanQuery.topup
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn('[useTopUpUrlLoader] Failed to clean URL params:', error)
    })
    clearPreservedQuery(NAMESPACE)
  }

  function openIfAllowed(param: unknown) {
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

  /** Reads `?topup=`, strips it, and opens the dialog when the gate allows. */
  async function loadTopUpFromUrl({ workspaceLinkRefused = false } = {}) {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const action = topUpLinkAction({
      param: query.topup,
      workspaceLinkRefused
    })
    if (action === 'none') return
    if (action === 'open') await initialize()
    stripParam(query)
    if (action === 'refuse')
      useToast().info(t('workspace.deepLinkTopUpRefused'))
    if (action === 'open') openIfAllowed(query.topup)
  }

  return {
    loadTopUpFromUrl
  }
}
