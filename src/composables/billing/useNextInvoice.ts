import { computed } from 'vue'

import type { SubscriptionInfo } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type {
  CurrentTeamCreditStop,
  Plan,
  SubscriptionDuration,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

export interface NextInvoiceInputs {
  subscription: SubscriptionInfo | null
  planSlug: string | null
  plans: Plan[]
  teamCreditStops: TeamCreditStops | null
  currentTeamCreditStop: CurrentTeamCreditStop | null
}

export interface NextInvoice {
  amountCents: number
  renewalDate: string | null
  duration: SubscriptionDuration
}

/**
 * Next invoice for the Settings > Invoices banner; annual subscriptions show
 * their yearly total and renewal date. Unit semantics: credit-stop
 * `yearly.price_cents` is a per-month figure (x12 for the invoice total)
 * while an ANNUAL plan's `price_cents` is already the yearly total.
 * `renewalDate` is BE-computed and passed through untouched — backends own
 * period math including month-end bias — and goes null once a cancellation
 * is scheduled. Cancelled/inactive return null because the cancelled Toast
 * owns that state. A non-positive resolved amount also returns null (free
 * tier can look like an active subscription with no real invoice).
 * Intentionally limited to the subscription price: usage/overage pending
 * charges are excluded until the backend exposes an authoritative
 * upcoming-invoice amount.
 */
export function deriveNextInvoice({
  subscription,
  planSlug,
  plans,
  teamCreditStops,
  currentTeamCreditStop
}: NextInvoiceInputs): NextInvoice | null {
  if (!subscription?.isActive || subscription.isCancelled) return null

  const duration = subscription.duration === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY'
  const stop = teamCreditStops?.stops.find(
    ({ id }) => id === currentTeamCreditStop?.id
  )
  const plan = plans.find(
    (candidate) =>
      candidate.slug === planSlug && candidate.duration === duration
  )
  const amountCents = stop
    ? duration === 'ANNUAL'
      ? stop.yearly.price_cents * 12
      : stop.monthly.price_cents
    : plan?.price_cents

  if (!amountCents || amountCents <= 0) return null

  return {
    amountCents,
    renewalDate: subscription.renewalDate,
    duration
  }
}

/**
 * Callers own billing-context initialization; a null invoice hides the
 * banner.
 */
export function useNextInvoice() {
  const {
    subscription,
    currentPlanSlug,
    plans,
    teamCreditStops,
    currentTeamCreditStop
  } = useBillingContext()

  const nextInvoice = computed(() =>
    deriveNextInvoice({
      subscription: subscription.value,
      planSlug: currentPlanSlug.value,
      plans: plans.value,
      teamCreditStops: teamCreditStops.value,
      currentTeamCreditStop: currentTeamCreditStop.value
    })
  )

  return { nextInvoice }
}
