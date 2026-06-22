import type { ComputedRef, Ref } from 'vue'

import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  BillingStatus,
  BillingSubscriptionStatus,
  CreateTopupResponse,
  CurrentTeamCreditStop,
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

export type BillingType = 'legacy' | 'workspace'

/** Coarse classification of the active subscription for transition gating. */
export type BillingPlanType = 'none' | 'personal' | 'new-team' | 'legacy-team'

export interface SubscriptionLock {
  /** Personal tiers (standard/creator/pro) may be subscribed or changed. */
  allowPersonalTiers: boolean
  /** The new-team credit-slider plan may be subscribed or changed. */
  allowTeamPlan: boolean
  /** Only re-subscribing on the exact current plan/stop is allowed. */
  resubscribeOnly: boolean
}

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
  /** Team per-credit pricing ladder; null for personal/legacy. */
  teamCreditStops: ComputedRef<TeamCreditStops | null>
  /** The team's currently-subscribed credit stop; null for personal/legacy. */
  currentTeamCreditStop: ComputedRef<CurrentTeamCreditStop | null>
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
  /**
   * True when the active team workspace is still on a pre-credit-slider
   * (legacy) per-member tier plan, which keeps the old team pricing table.
   */
  isLegacyTeamPlan: ComputedRef<boolean>
  /**
   * Coarse classification of the active subscription, driving which plan
   * transitions the pricing table may offer.
   */
  planType: ComputedRef<BillingPlanType>
  /** Which plan transitions are allowed for the active subscription. */
  subscriptionLock: ComputedRef<SubscriptionLock>
  getMaxSeats: (tierKey: TierKey) => number
}
