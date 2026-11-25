import { effectScope } from 'vue'

import { refreshBilling } from '@/platform/billing/billingRefresh'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

let latest:
  | { readonly returned: Event; readonly read: Promise<unknown> }
  | undefined

async function refreshCapabilities(): Promise<void> {
  const scope = effectScope(true)
  try {
    await scope.run(useBillingCapabilities)?.refresh()
  } finally {
    scope.stop()
  }
}

/** Re-reads plan, balance and capabilities once for `returned`, the return to this tab, however many listeners saw it. */
export function refreshBillingAccount(returned: Event): Promise<unknown> {
  if (latest?.returned !== returned) {
    latest = {
      returned,
      read: Promise.allSettled([
        refreshBilling('account'),
        refreshCapabilities()
      ])
    }
  }
  return latest.read
}
