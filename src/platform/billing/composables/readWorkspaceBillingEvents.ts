import { billingApi } from '@/platform/billing/api/billingApi'
import { readOnRail } from '@/platform/billing/composables/readOnRail'
import { useBillingReadRail } from '@/platform/billing/composables/useBillingReadRail'

/** Undefined when the scope moved on under the read. */
export function readWorkspaceBillingEvents(params: {
  page: number
  limit: number
}) {
  const rail = useBillingReadRail()
  return rail === null
    ? billingApi.getBillingEvents(params)
    : readOnRail(() => rail.readEvents(params), 'getBillingEvents')
}
