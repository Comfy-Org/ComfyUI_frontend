import { onScopeDispose } from 'vue'

import { refreshBillingAccount } from '@/platform/billing/billingAccountRefresh'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { isCloud } from '@/platform/distribution/types'

/** On local, re-reads plan, balance and capabilities on each return to this tab or window. */
export function useRefreshBillingOnReturn(): void {
  if (isCloud) return
  const billing = useBillingContext()
  onScopeDispose(
    registerRefreshOnReturn(async (returned) => {
      if (!billing.isInitialized.value) return
      await refreshBillingAccount(returned)
    })
  )
}
