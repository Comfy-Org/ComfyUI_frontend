import type {
  zSubscriptionPaymentRecovery,
  zSubscriptionTier
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

export type SubscriptionPaymentRecovery = z.infer<
  typeof zSubscriptionPaymentRecovery
>

/** How the signup operation lets the customer pay: loading until read, unavailable when the read failed or serves no way to pay here. */
export type RecoveryPaymentPage =
  | { readonly kind: 'loading' }
  | { readonly kind: 'hostedPage' }
  | { readonly kind: 'clientSecretOnly'; readonly checkoutUrl: string }
  | { readonly kind: 'unavailable' }

export interface PlanNotStartedBanner {
  readonly planTier: z.infer<typeof zSubscriptionTier> | null
  readonly paymentPage: Exclude<RecoveryPaymentPage, { kind: 'loading' }>
}

export interface PlanNotStartedFacts {
  readonly isCloud: boolean
  readonly recovery: SubscriptionPaymentRecovery | null
  readonly planTier: PlanNotStartedBanner['planTier']
  readonly paymentPage: RecoveryPaymentPage
}

/** The Billing-tab banner for a served unfinished first plan payment, once its operation is read; Cloud only. */
export function planNotStartedBannerFor({
  isCloud,
  recovery,
  planTier,
  paymentPage
}: PlanNotStartedFacts): PlanNotStartedBanner | null {
  if (!isCloud || !recovery || paymentPage.kind === 'loading') return null
  return { planTier, paymentPage }
}
