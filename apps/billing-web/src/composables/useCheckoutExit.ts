import { computed } from 'vue'
import type { Ref } from 'vue'

import type { BillingEntry, ReturnTarget } from '@comfyorg/billing-contract'
import { buildReturnUrl } from '@comfyorg/billing-contract'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import { platformBillingUrl, platformPlansUrl } from '@/checkout/platformLinks'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { BILLING_WEB_ENV } from '@/config/env'
import { useBillingEntry } from '@/entry/billingEntry'
import { returnToHost } from '@/entry/returnToHost'
import { handoffTab } from '@/handoff/handoffTab'

const CLOUD_RETURN_TARGETS: readonly ReturnTarget[] = [
  'comfyui_workspace',
  'comfyui_credits'
]

const backsOutToPlatformPlans = (arrival: BillingEntry) =>
  arrival.intent === 'checkout' &&
  arrival.product === 'platform' &&
  CLOUD_RETURN_TARGETS.includes(arrival.returnTo)

/** Where a full-page checkout leaves to; Close in a handoff tab only ever closes it. */
export function useCheckoutExit(page: Readonly<Ref<CheckoutPage>>) {
  const { entry } = useBillingEntry()
  const billedWorkspace = useBilledWorkspace()

  const returnLink = computed(() => {
    const workspace = billedWorkspace()
    const arrival = entry.value
    const current = page.value
    if (!arrival) return platformBillingUrl(workspace)
    if (current.kind !== 'terminal' && backsOutToPlatformPlans(arrival))
      return platformPlansUrl(arrival, workspace)
    return (
      buildReturnUrl({
        target: arrival.returnTo,
        environment: BILLING_WEB_ENV,
        workspace,
        ...(current.kind === 'terminal'
          ? { result: 'success', reference: current.operation?.id }
          : {})
      })?.href ?? platformBillingUrl(workspace)
    )
  })

  const openedByScript = Boolean(window.opener)

  function close() {
    if (handoffTab.value === undefined) returnToHost(returnLink.value)
    else window.close()
  }

  return { returnLink, openedByScript, close }
}
