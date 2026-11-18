import type {
  zSubscriptionPaymentRecovery,
  zSubscriptionTier
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

export type SubscriptionPaymentRecovery = z.infer<
  typeof zSubscriptionPaymentRecovery
>

export interface PlanNotStartedBanner {
  readonly planTier: z.infer<typeof zSubscriptionTier> | null
  readonly actionUrl: string | null
}

export interface PlanNotStartedFacts extends PlanNotStartedBanner {
  readonly isCloud: boolean
  readonly recovery: SubscriptionPaymentRecovery | null
}

/** The Billing-tab banner for a served unfinished first plan payment, with the operation's served payment page; Cloud only. */
export function planNotStartedBannerFor(
  facts: PlanNotStartedFacts
): PlanNotStartedBanner | null {
  if (!facts.isCloud || !facts.recovery) return null
  return { planTier: facts.planTier, actionUrl: facts.actionUrl }
}
