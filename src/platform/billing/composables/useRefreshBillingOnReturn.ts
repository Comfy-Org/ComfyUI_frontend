import { onScopeDispose } from 'vue'

import { refreshBilling } from '@/platform/billing/billingRefresh'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { isCloud } from '@/platform/distribution/types'

/** On local, re-reads plan, balance and capabilities on each return to this tab or window. */
export function useRefreshBillingOnReturn(): void {
  if (isCloud) return
  const billing = useBillingContext()
  const capabilities = useBillingCapabilities()
  onScopeDispose(
    registerRefreshOnReturn(async () => {
      if (!billing.isInitialized.value) return
      await Promise.allSettled([
        refreshBilling('account'),
        capabilities.refresh()
      ])
    })
  )
}
