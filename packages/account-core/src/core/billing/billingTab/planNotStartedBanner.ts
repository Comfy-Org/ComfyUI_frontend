import type {
  SubscriptionPaymentRecovery,
  SubscriptionTier
} from '@comfyorg/ingest-types'

export interface PlanNotStartedBanner {
  readonly planTier: SubscriptionTier | null
}

export interface PlanNotStartedFacts {
  readonly isCloud: boolean
  readonly recovery: SubscriptionPaymentRecovery | null
  readonly planTier: SubscriptionTier | null
}

/** The Billing-tab banner for a served unfinished first plan payment; Cloud only. */
export function planNotStartedBannerFor(
  facts: PlanNotStartedFacts
): PlanNotStartedBanner | null {
  if (!facts.isCloud || !facts.recovery) return null
  return { planTier: facts.planTier }
}
