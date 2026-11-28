import { onScopeDispose } from 'vue'

import { refreshBillingAccount } from '@/platform/billing/billingAccountRefresh'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { isCloud } from '@/platform/distribution/types'

/** Re-reads plan, balance and capabilities on each return to this tab or window: always on local, on Cloud only with `includeCloud`. */
export function useRefreshBillingOnReturn({ includeCloud = false } = {}): void {
  if (isCloud && !includeCloud) return
  const billing = useBillingContext()
  onScopeDispose(
    registerRefreshOnReturn(async (returned) => {
      if (!billing.isInitialized.value) return
      await refreshBillingAccount(returned)
    })
  )
}
