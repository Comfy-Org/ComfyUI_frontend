import { computed } from 'vue'
import type { Ref } from 'vue'

import { buildReturnUrl } from '@comfyorg/billing-contract'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import { planCreditsSettingsUrl } from '@/checkout/cloudLinks'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { BILLING_WEB_ENV } from '@/config/env'
import { useBillingEntry } from '@/entry/billingEntry'
import { returnToHost } from '@/entry/returnToHost'

/**
 * Where a full-page checkout leaves to: back to the product, with a settled
 * payment's outcome and reference, or to the workspace's Plan & Credits
 * settings when this family has no destination for the link's target. Close
 * shuts the tab when the browser allows it and goes back otherwise.
 */
export function useCheckoutExit(page: Readonly<Ref<CheckoutPage>>) {
  const { entry } = useBillingEntry()
  const billedWorkspace = useBilledWorkspace()

  const returnLink = computed(() => {
    const workspace = billedWorkspace()
    const arrival = entry.value
    const current = page.value
    const host =
      arrival &&
      buildReturnUrl({
        target: arrival.returnTo,
        environment: BILLING_WEB_ENV,
        workspace,
        ...(current.kind === 'terminal'
          ? { result: 'success', reference: current.operation?.id }
          : {})
      })?.href
    return host ?? planCreditsSettingsUrl(workspace)
  })

  const openedByScript = Boolean(window.opener)

  function close() {
    returnToHost(returnLink.value)
  }

  return { returnLink, openedByScript, close }
}
