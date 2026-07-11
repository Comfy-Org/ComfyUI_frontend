import { computed } from 'vue'

import type { SubscriptionInfo } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type {
  CurrentTeamCreditStop,
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

export interface NextInvoiceInputs {
  subscription: SubscriptionInfo | null
  planSlug: string | null
  plans: Plan[]
  teamCreditStops: TeamCreditStops | null
  currentTeamCreditStop: CurrentTeamCreditStop | null
}

/**
 * Monthly renewal price of the current subscription in cents, or null when no
 * "next month invoice" exists (inactive, cancelled, or annual — DES-469 hides
 * the banner when there is no meaningful upcoming monthly invoice) or the
 * price cannot be resolved from the fetched billing state. Intentionally
 * limited to the subscription price: usage/overage pending charges are
 * excluded until the backend exposes an authoritative upcoming-invoice amount.
 */
export function deriveNextInvoiceCents({
  subscription,
  planSlug,
  plans,
  teamCreditStops,
  currentTeamCreditStop
}: NextInvoiceInputs): number | null {
  if (!subscription?.isActive || subscription.isCancelled) return null
  if (subscription.duration === 'ANNUAL') return null

  const stop = teamCreditStops?.stops.find(
    ({ id }) => id === currentTeamCreditStop?.id
  )
  if (stop) return stop.monthly.price_cents

  const plan = plans.find(({ slug }) => slug === planSlug)
  return plan?.price_cents ?? null
}

/**
 * Next-invoice amount for the Settings > Plan & Credits "Next month invoice"
 * banner (DES-497 / DES-469), derived from billing state already fetched by
 * the active billing context. Callers own context initialization; a null
 * amount means the banner should stay hidden.
 */
export function useNextInvoice() {
  const {
    subscription,
    currentPlanSlug,
    plans,
    teamCreditStops,
    currentTeamCreditStop
  } = useBillingContext()

  const nextInvoiceCents = computed(() =>
    deriveNextInvoiceCents({
      subscription: subscription.value,
      planSlug: currentPlanSlug.value,
      plans: plans.value,
      teamCreditStops: teamCreditStops.value,
      currentTeamCreditStop: currentTeamCreditStop.value
    })
  )

  return { nextInvoiceCents }
}
