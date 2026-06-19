import type { ComputedRef, Ref } from 'vue'

import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  BillingStatus,
  BillingSubscriptionStatus,
  CreateTopupResponse,
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier
} from '@/platform/workspace/api/workspaceApi'

export type BillingType = 'legacy' | 'workspace'

export interface SubscriptionInfo {
  isActive: boolean
  tier: SubscriptionTier | null
  duration: SubscriptionDuration | null
  planSlug: string | null
  /** ISO 8601 */
  renewalDate: string | null
  /** ISO 8601 */
  endDate: string | null
  isCancelled: boolean
  hasFunds: boolean
}

export interface BalanceInfo {
  amountMicros: number
  currency: string
  effectiveBalanceMicros?: number
  prepaidBalanceMicros?: number
  cloudCreditBalanceMicros?: number
}

export interface BillingActions {
  initialize: () => Promise<void>
  fetchStatus: () => Promise<void>
  fetchBalance: () => Promise<void>
  subscribe: (
    planSlug: string,
    returnUrl?: string,
    cancelUrl?: string
  ) => Promise<SubscribeResponse | void>
  previewSubscribe: (
    planSlug: string
  ) => Promise<PreviewSubscribeResponse | null>
  manageSubscription: () => Promise<void>
  cancelSubscription: () => Promise<void>
  resubscribe: () => Promise<void>
  /** `amountCents` must be a whole-dollar multiple of 100. */
  topup: (amountCents: number) => Promise<CreateTopupResponse | void>
  fetchPlans: () => Promise<void>
  /**
   * Ensures billing is initialized and subscription is active.
   * Shows subscription dialog if not subscribed.
   * Use this in extensions/entry points that require active subscription.
   */
  requireActiveSubscription: () => Promise<void>
  /**
   * Shows the subscription dialog.
   */
  showSubscriptionDialog: () => void
}

export interface BillingState {
  isInitialized: Ref<boolean>
  subscription: ComputedRef<SubscriptionInfo | null>
  balance: ComputedRef<BalanceInfo | null>
  plans: ComputedRef<Plan[]>
  currentPlanSlug: ComputedRef<string | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  isActiveSubscription: ComputedRef<boolean>
  isFreeTier: ComputedRef<boolean>
  billingStatus: ComputedRef<BillingStatus | null>
  subscriptionStatus: ComputedRef<BillingSubscriptionStatus | null>
  tier: ComputedRef<SubscriptionTier | null>
  renewalDate: ComputedRef<string | null>
}

export interface BillingContext extends BillingState, BillingActions {
  type: ComputedRef<BillingType>
  getMaxSeats: (tierKey: TierKey) => number
}
