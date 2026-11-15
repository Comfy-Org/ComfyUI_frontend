import { refreshBilling } from '@/platform/billing/billingRefresh'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

let reading: Promise<unknown> | undefined

/** Re-reads plan, balance and capabilities; calls made during a read share it. */
export function refreshBillingAccount(): Promise<unknown> {
  reading ??= Promise.allSettled([
    refreshBilling('account'),
    useBillingCapabilities().refresh()
  ]).finally(() => {
    reading = undefined
  })
  return reading
}
