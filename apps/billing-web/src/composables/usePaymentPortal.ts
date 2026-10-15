import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type {
  BillingFailure,
  BillingPortalTarget
} from '@comfyorg/account-core/billing'
import { useBillingClient } from '@comfyorg/account-ui/billing'

import { reportPortal } from '@/telemetry/portalTelemetry'

/** Marks the customer's trip back from the provider's hosted portal. */
const PORTAL_PARAM = 'portal'
const PORTAL_RETURN = 'return'

/** Sends the customer to the provider's portal and back to this page. */
export function usePaymentPortal(target: BillingPortalTarget) {
  const route = useRoute()
  const router = useRouter()
  const { commands } = useBillingClient<'commands'>(undefined)

  const returningFromPortal = route.query[PORTAL_PARAM] === PORTAL_RETURN
  const opening = ref(false)
  const refusal = ref<BillingFailure | undefined>()

  if (returningFromPortal) reportPortal(target, { stage: 'returned' })

  function portalReturnUrl(): string {
    const url = new URL(window.location.href)
    url.searchParams.set(PORTAL_PARAM, PORTAL_RETURN)
    return url.href
  }

  async function openPortal() {
    opening.value = true
    refusal.value = undefined
    const result = await commands.openPaymentPortal({
      returnUrl: portalReturnUrl()
    })
    opening.value = false
    if (result.status === 'error') {
      refusal.value = result
      reportPortal(target, { stage: 'failed', refusal: result })
      return
    }
    reportPortal(target, { stage: 'opened' })
    window.location.assign(result.value.url)
  }

  async function dropReturnMarker() {
    await router.replace({
      path: route.path,
      query: Object.fromEntries(
        Object.entries(route.query).filter(([key]) => key !== PORTAL_PARAM)
      )
    })
  }

  return { returningFromPortal, opening, refusal, openPortal, dropReturnMarker }
}
