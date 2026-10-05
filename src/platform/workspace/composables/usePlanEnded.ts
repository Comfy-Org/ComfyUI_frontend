import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { isSalesManagedTier } from '@/platform/cloud/subscription/constants/tierPricing'
import { useTeamPlan } from '@/platform/workspace/composables/useTeamPlan'

export function usePlanEnded() {
  const { subscription, subscriptionStatus, canAccessSubscriptionFeatures } =
    useBillingContext()
  const { hasTeamPlan } = useTeamPlan()

  // Ended (billing_status inactive) is the only member-management freeze.
  // A cancel-scheduled subscription stays active until cancel_at and the
  // backend permits seat adds the whole time — capability, invite endpoint,
  // and Stripe write path all allow it (DES-1200; verified on cloud/main
  // 2026-09-23) — so cancelled workspaces keep invites live. Two payload
  // shapes report a terminal plan: subscription_status 'ended', and a
  // cancelled row whose access has already closed (the backend reconciles
  // that shape into 'ended' on read, but a stale payload can still carry
  // it). Scoped by subscription shape, not seat capacity: when a plan
  // truly ends the backend collapses max_seats to the no-plan default of 1
  // (observed on test: ended + ENTERPRISE + max_seats 1), so a seat gate
  // reads the flagship ended workspace as "seatless" and hides the very
  // explanation this state exists to show. A lapsed personal subscription
  // stays out via the team/sales-managed gate instead.
  const isPlanTerminal = computed(
    () =>
      subscriptionStatus.value === 'ended' ||
      (subscriptionStatus.value === 'canceled' &&
        !canAccessSubscriptionFeatures.value)
  )
  // Qualifying for the treatment needs a KNOWN signal — the team classifier
  // or a real tier that is sales-managed. A terminal payload with no tier
  // and no team signal is most plausibly a lapsed personal subscription,
  // which belongs to the upgrade banner. (The nullish fail-close in
  // isSalesManagedPlan below governs only the route back once a workspace
  // is already in the treatment.)
  const isPlanEnded = computed(() => {
    if (!isPlanTerminal.value) return false
    if (hasTeamPlan.value) return true
    const tier = subscription.value?.tier
    return tier != null && isSalesManagedTier(tier)
  })
  // Sales-managed, not strictly ENTERPRISE: isSalesManagedTier() treats an
  // unrecognized tier as sales-managed too, so an ended unknown/future plan
  // routes to Contact sales rather than borrowing the self-serve Reactivate
  // claim (the same fail-closed contract the pricing surfaces follow). A
  // missing tier is equally unidentifiable, so it fails closed to the sales
  // route too — never a self-serve Resume the capability would refuse.
  const isSalesManagedPlan = computed(() => {
    const tier = subscription.value?.tier
    return tier == null ? true : isSalesManagedTier(tier)
  })
  // Strict: drives the contactSales copy only — an unrecognized tier keeps
  // the sales route but gets plan-neutral wording.
  const isEnterprisePlan = computed(
    () => subscription.value?.tier === 'ENTERPRISE'
  )

  return { isPlanEnded, isSalesManagedPlan, isEnterprisePlan }
}
