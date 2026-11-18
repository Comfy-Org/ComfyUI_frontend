import type {
  zSubscriptionPaymentRecovery,
  zSubscriptionTier
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

export type SubscriptionPaymentRecovery = z.infer<
  typeof zSubscriptionPaymentRecovery
>

/** Whether the signup operation serves a hosted payment page; unknown while it is unread or its read failed. */
export type RecoveryPaymentPage = 'unknown' | 'hostedPage' | 'noHostedPage'

export interface PlanNotStartedBanner {
  readonly planTier: z.infer<typeof zSubscriptionTier> | null
  readonly paymentPage: RecoveryPaymentPage
}

export interface PlanNotStartedFacts extends PlanNotStartedBanner {
  readonly isCloud: boolean
  readonly recovery: SubscriptionPaymentRecovery | null
}

/** The Billing-tab banner for a served unfinished first plan payment, with what the operation serves of its payment page; Cloud only. */
export function planNotStartedBannerFor(
  facts: PlanNotStartedFacts
): PlanNotStartedBanner | null {
  if (!facts.isCloud || !facts.recovery) return null
  return { planTier: facts.planTier, paymentPage: facts.paymentPage }
}
