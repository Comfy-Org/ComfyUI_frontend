import type { ComputedRef, Ref } from 'vue'

import type { SubscriptionDialogOptions } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  BillingStatus,
  BillingSubscriptionStatus,
  CreateTopupResponse,
  CurrentTeamCreditStop,
  Plan,
  PreviewSubscribeOptions,
  PreviewSubscribeResponse,
  SubscribeOptions,
  SubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

export type BillingType = 'legacy' | 'workspace'

export interface SubscriptionInfo {
  isActive: boolean
  tier: SubscriptionTier | null
  duration: SubscriptionDuration | null
  planSlug: string | null
  /** ISO 8601; format at the display site. */
  renewalDate: string | null
  /** ISO 8601; format at the display site. */
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
    options?: SubscribeOptions
  ) => Promise<SubscribeResponse | void>
  previewSubscribe: (
    planSlug: string,
    options?: PreviewSubscribeOptions
  ) => Promise<PreviewSubscribeResponse | null>
  manageSubscription: () => Promise<void>
  cancelSubscription: () => Promise<void>
  /**
   * Reactivates a cancelled-but-still-active subscription. Legacy has no
   * dedicated endpoint, so the legacy adapter re-runs the checkout flow.
   * The workspace adapter refreshes status and balance internally on success.
   */
  resubscribe: () => Promise<void>
  /**
   * Purchases additional credits. Standardized on **whole-dollar cents**
   * (multiples of 100); the legacy adapter divides by 100 for the
   * dollar-based /customers/credit endpoint.
   * Pass-through by design: the caller owns the completed/pending follow-up
   * (balance refresh or billing-op polling), so this does not refresh.
   */
  topup: (amountCents: number) => Promise<CreateTopupResponse | void>
  fetchPlans: () => Promise<void>
  /**
   * Ensures billing is initialized and subscription is active.
   * Shows subscription dialog if not subscribed.
   * Use this in extensions/entry points that require active subscription.
   */
  requireActiveSubscription: () => Promise<void>
  /**
   * Shows the subscription dialog. Pass a reason so the paywall open and any
   * downstream checkout stay attributed to the triggering product moment.
   */
  showSubscriptionDialog: (options?: SubscriptionDialogOptions) => void
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
  /** Reflects the active workspace's tier, not the user's personal tier. */
  isFreeTier: ComputedRef<boolean>
  /** Coarse funding state (`billing_status`); legacy reports null. */
  billingStatus: ComputedRef<BillingStatus | null>
  /** Lifecycle state; legacy synthesizes it from active/cancelled flags. */
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
   * True when the subscription is a team plan of either generation. Unlike
   * `isLegacyTeamPlan` this does not require an active subscription: the spend
   * gate folds billing_status into is_active, so a paused or payment-failed team
   * plan reports is_active=false and must still read as a team plan.
   */
  isTeamPlan: ComputedRef<boolean>
  getMaxSeats: (tierKey: TierKey) => number
}
